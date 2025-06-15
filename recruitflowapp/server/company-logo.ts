import { Express, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';

// Configure multer for logo uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: Function) {
      const uploadDir = 'public/uploads/logos';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: Function) {
      // Use company ID in filename for uniqueness
      const companyId = (req as any).user?.companyId || 'unknown';
      const ext = path.extname(file.originalname);
      cb(null, `company-${companyId}-${Date.now()}${ext}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req: Request, file: Express.Multer.File, cb: Function) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.'), false);
    }
  }
});

export function setupCompanyLogoRoutes(app: Express) {
  // Logo upload endpoint
  app.post('/api/company/logo', upload.single('logo'), async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const companyId = (req as any).user.companyId;
      const logoUrl = `/uploads/logos/${req.file.filename}`;
      
      // Update company with new logo URL
      await storage.updateCompany(companyId, { logoUrl });
      
      res.json({
        success: true,
        logoUrl: logoUrl,
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error('Logo upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Delete logo endpoint
  app.delete('/api/company/logo', async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const companyId = (req as any).user.companyId;
      
      // Get current company to find logo file
      const company = await storage.getCompanyById(companyId);
      
      if (company?.logoUrl) {
        // Remove file from filesystem
        const filename = path.basename(company.logoUrl);
        const filePath = path.join('public/uploads/logos', filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Remove logo URL from company
      await storage.updateCompany(companyId, { logoUrl: null });
      
      res.json({ success: true, message: 'Logo removed' });
    } catch (error) {
      console.error('Logo deletion error:', error);
      res.status(500).json({ error: 'Deletion failed' });
    }
  });
}