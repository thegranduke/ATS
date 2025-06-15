import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Express, Request, Response, NextFunction } from 'express';
import { storage as dbStorage } from './storage';
import fs from 'fs';

// Use the existing User type which should be declared elsewhere
import { User } from '@shared/schema';

// Request user type definition
declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      user?: {
        id: number;
      };
    }
  }
}

// Set up multer for handling document uploads
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req: Express.Request, file: Express.Multer.File, cb: Function) {
    // Accept commonly used document file types
    const filetypes = /pdf|doc|docx|txt|rtf|odt|xls|xlsx|ppt|pptx|csv|json|zip/;
    const mimetype = filetypes.test(file.mimetype) || 
                     file.mimetype === 'application/octet-stream' || 
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error('Only document files are allowed!'));
  }
});

// Function to upload to Google Cloud Storage
async function uploadToGCS(filePath: string, fileName: string): Promise<string> {
  // Get bucket name from environment variables
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  
  // If no Google Cloud Storage credentials, use local storage
  if (!process.env.GOOGLE_CLOUD_CREDENTIALS || !bucketName) {
    return storeLocally(filePath, fileName);
  }
  
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
  });

  try {
    // Upload file to GCS
    await storage.bucket(bucketName).upload(filePath, {
      destination: `documents/${fileName}`,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Make the file publicly accessible
    await storage.bucket(bucketName).file(`documents/${fileName}`).makePublic();

    // Construct the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/documents/${fileName}`;
    
    // Delete local file after upload
    fs.unlinkSync(filePath);
    
    return fileName; // Return just the object key
  } catch (error) {
    console.error('Error uploading to GCS:', error);
    // Fallback to local storage if GCS upload fails
    return storeLocally(filePath, fileName);
  }
}

// Function to store files locally when GCS is not available
async function storeLocally(filePath: string, fileName: string): Promise<string> {
  // Create directory if it doesn't exist
  const documentsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }

  // Copy file to destination
  const destinationPath = path.join(documentsDir, fileName);
  fs.copyFileSync(filePath, destinationPath);
  
  // Delete the temp file
  fs.unlinkSync(filePath);
  
  return fileName; // Return just the object key
}

// Utility to delete a document file
async function deleteFile(objectKey: string): Promise<void> {
  // Check if Google Cloud Storage is configured
  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  
  if (process.env.GOOGLE_CLOUD_CREDENTIALS && bucketName) {
    // Delete from GCS
    const storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
    });
    
    try {
      await storage.bucket(bucketName).file(`documents/${objectKey}`).delete();
      console.log(`Deleted document from GCS: documents/${objectKey}`);
    } catch (error) {
      console.error(`Failed to delete document from GCS: ${error}`);
    }
  } else {
    // Delete from local storage
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'documents', objectKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted document from local storage: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete document from local storage: ${error}`);
    }
  }
}

// Set up document file routes
export function setupDocumentRoutes(app: Express) {
  // Ensure uploads/documents directory exists
  const documentsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }
  console.log(`Setting up static directory for documents: ${documentsDir}`);

  // Debug endpoint to check if document files exist
  app.get('/check-document-files', (req: Request, res: Response) => {
    const documentsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    let files: string[] = [];
    
    if (fs.existsSync(documentsDir)) {
      files = fs.readdirSync(documentsDir);
    }
    
    res.json({
      success: fs.existsSync(documentsDir),
      message: fs.existsSync(documentsDir) ? 'Documents directory exists' : 'Documents directory does not exist',
      path: documentsDir,
      files,
      count: files.length
    });
  });

  // Upload document for a candidate
  app.post('/api/candidates/:candidateId/documents', upload.single('document'), async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      const candidateId = parseInt(req.params.candidateId);
      
      // Validate candidate exists and belongs to user's company
      const candidate = await dbStorage.getCandidateById(candidateId);
      if (!candidate) {
        return res.status(404).send('Candidate not found');
      }
      
      if (!req.user) {
        return res.status(401).send('User not authenticated');
      }
      
      const user = await dbStorage.getUser(req.user.id);
      if (!user || user.companyId !== candidate.companyId) {
        return res.status(403).send('Forbidden: You do not have access to this candidate');
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).send('No file uploaded');
      }
      
      // Upload file to storage
      const objectKey = await uploadToGCS(req.file.path, req.file.filename);
      
      // Get document name from request body or use original filename
      const documentName = req.body.name || req.file.originalname;
      
      // Construct URL for document access
      let url;
      if (process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
        url = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}/documents/${objectKey}`;
      } else {
        url = `/uploads/documents/${objectKey}`;
      }
      
      // Get the company ID from the authenticated user
      const userData = await dbStorage.getUser(req.user.id);
      
      // Create document record in database
      const document = await dbStorage.createDocument({
        name: documentName,
        type: req.file.mimetype,
        url,
        companyId: userData?.companyId || 0,
        candidateId
      });
      
      // Return document data
      res.status(201).json(document);
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).send(`Error uploading document: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Get all documents for a candidate
  app.get('/api/candidates/:candidateId/documents', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      const candidateId = parseInt(req.params.candidateId);
      
      // Validate candidate exists and belongs to user's company
      const candidate = await dbStorage.getCandidateById(candidateId);
      if (!candidate) {
        return res.status(404).send('Candidate not found');
      }
      
      if (!req.user) {
        return res.status(401).send('User not authenticated');
      }
      
      const user = await dbStorage.getUser(req.user.id);
      if (!user || user.companyId !== candidate.companyId) {
        return res.status(403).send('Forbidden: You do not have access to this candidate');
      }
      
      // Get documents for candidate
      const documents = await dbStorage.getDocumentsByCandidate(candidateId);
      
      // Prepare documents for frontend use
      const documentsWithUrls = documents.map(doc => {
        // For backward compatibility, add documentUrl as an alias to url
        return {
          ...doc,
          documentUrl: doc.url,
          // For old code that might expect objectKey
          objectKey: doc.url.split('/').pop() || ''
        };
      });
      
      res.json(documentsWithUrls);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).send(`Error fetching documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Update document info
  app.put('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      const documentId = parseInt(req.params.id);
      
      // Validate document exists
      const document = await dbStorage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).send('Document not found');
      }
      
      // Check if document is associated with a candidate
      if (document.candidateId === null) {
        return res.status(400).send('Document is not associated with any candidate');
      }
      
      // Validate document belongs to a candidate in user's company
      const candidate = await dbStorage.getCandidateById(document.candidateId);
      if (!candidate) {
        return res.status(404).send('Candidate not found');
      }
      
      if (!req.user) {
        return res.status(401).send('User not authenticated');
      }
      
      const user = await dbStorage.getUser(req.user.id);
      if (!user || user.companyId !== candidate.companyId) {
        return res.status(403).send('Forbidden: You do not have access to this document');
      }
      
      // Update document with new data (only name can be updated)
      const updatedDocument = await dbStorage.updateDocument(documentId, {
        name: req.body.name
      });
      
      res.json(updatedDocument);
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).send(`Error updating document: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Delete document
  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).send('Unauthorized');
      }
      
      const documentId = parseInt(req.params.id);
      
      // Validate document exists
      const document = await dbStorage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).send('Document not found');
      }
      
      // Check if document is associated with a candidate
      if (document.candidateId === null) {
        return res.status(400).send('Document is not associated with any candidate');
      }
      
      // Validate document belongs to a candidate in user's company
      const candidate = await dbStorage.getCandidateById(document.candidateId);
      if (!candidate) {
        return res.status(404).send('Candidate not found');
      }
      
      if (!req.user) {
        return res.status(401).send('User not authenticated');
      }
      
      const user = await dbStorage.getUser(req.user.id);
      if (!user || user.companyId !== candidate.companyId) {
        return res.status(403).send('Forbidden: You do not have access to this document');
      }
      
      // Extract filename from URL for deletion
      const filename = document.url.split('/').pop();
      if (filename) {
        await deleteFile(filename);
      }
      
      // Delete document from database
      await dbStorage.deleteDocument(documentId);
      
      res.status(200).send({ success: true });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).send(`Error deleting document: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}