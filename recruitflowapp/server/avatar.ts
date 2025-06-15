import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Express, Request, Response } from 'express';
import { storage as dbStorage } from './storage';
import fs from 'fs';

// Set up multer for handling file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req: Express.Request, file: Express.Multer.File, cb: Function) {
      const uploadDir = path.join(process.cwd(), 'temp_uploads');
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req: Express.Request, file: Express.Multer.File, cb: Function) {
      const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req: Express.Request, file: Express.Multer.File, cb: Function) {
    // Accept only image files
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Initialize Google Cloud Storage if credentials are available
let storage: Storage | null = null;

// Configure GCS storage from environment variables
try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    storage = new Storage({ credentials });
    console.log('Google Cloud Storage initialized successfully');
  } else {
    console.log('Google Cloud Storage credentials not found, will use file system storage');
  }
} catch (error) {
  console.error('Failed to initialize Google Cloud Storage:', error);
}

// Function to upload file to Google Cloud Storage
async function uploadToGCS(filePath: string, fileName: string): Promise<string> {
  if (!storage) {
    throw new Error('Google Cloud Storage not initialized');
  }
  
  const bucketName = process.env.GCS_BUCKET_NAME || 'default-recruitflow-bucket';
  
  try {
    // Check if bucket exists, create if not
    const [buckets] = await storage.getBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      await storage.createBucket(bucketName);
      console.log(`Bucket ${bucketName} created`);
    }
    
    const bucket = storage.bucket(bucketName);
    const destination = `avatars/${fileName}`;
    
    // Upload file
    await bucket.upload(filePath, {
      destination,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Make the file publicly accessible
    await bucket.file(destination).makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    
    // Remove the temporary file
    fs.unlinkSync(filePath);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to GCS:', error);
    throw error;
  }
}

// Function to store local file in server storage
async function storeLocally(filePath: string, fileName: string): Promise<string> {
  const staticDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }
  
  const destination = path.join(staticDir, fileName);
  
  // Copy file to destination
  fs.copyFileSync(filePath, destination);
  
  // Remove the temporary file
  fs.unlinkSync(filePath);
  
  // Log success info for debugging
  console.log(`Avatar file saved successfully: ${destination}`);
  console.log(`Avatar URL path: /uploads/avatars/${fileName}`);
  
  // Return the path that will be accessible by the client
  return `/uploads/avatars/${fileName}`;
}

// Function to delete a file from Google Cloud Storage or local storage
async function deleteFile(fileUrl: string): Promise<void> {
  if (!fileUrl) return;
  
  try {
    if (fileUrl.includes('storage.googleapis.com')) {
      // Delete from Google Cloud Storage
      if (!storage) {
        throw new Error('Google Cloud Storage not initialized');
      }
      
      // Extract bucket name and file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const bucketName = pathParts[1];
      const filePath = pathParts.slice(2).join('/');
      
      await storage.bucket(bucketName).file(filePath).delete();
    } else {
      // Delete from local file system
      const filePath = path.join(process.cwd(), 'public', fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Set up routes for avatar management
export function setupAvatarRoutes(app: Express) {
  // Upload avatar route
  app.post('/api/user/avatar/upload', upload.single('avatar'), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user!.id;
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const file = req.file;
      
      // Get current user to check if they have an existing avatar
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Delete existing avatar if it exists
      if (user.avatarUrl) {
        await deleteFile(user.avatarUrl);
      }
      
      // Upload file to storage
      let avatarUrl: string;
      if (storage && process.env.GCS_BUCKET_NAME) {
        // Use Google Cloud Storage
        avatarUrl = await uploadToGCS(file.path, file.filename);
      } else {
        // Use local file storage
        avatarUrl = await storeLocally(file.path, file.filename);
      }
      
      // Update user record with new avatar URL
      await dbStorage.updateUser(userId, { avatarUrl });
      
      res.json({ avatarUrl });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });
  
  // Update avatar color route
  app.patch('/api/user/avatar', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user!.id;
      const { avatarColor } = req.body;
      
      // Validate avatar color
      if (avatarColor && !/^#[0-9A-F]{6}$/i.test(avatarColor)) {
        return res.status(400).json({ error: 'Invalid color format' });
      }
      
      // Update user record with new avatar color
      await dbStorage.updateUser(userId, { avatarColor });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating avatar color:', error);
      res.status(500).json({ error: 'Failed to update avatar color' });
    }
  });
  
  // Delete avatar route
  app.delete('/api/user/avatar', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user!.id;
      
      // Get current user to check if they have an existing avatar
      const user = await dbStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Delete existing avatar if it exists
      if (user.avatarUrl) {
        await deleteFile(user.avatarUrl);
      }
      
      // Update user record to remove avatar URL
      await dbStorage.updateUser(userId, { avatarUrl: null });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting avatar:', error);
      res.status(500).json({ error: 'Failed to delete avatar' });
    }
  });
}