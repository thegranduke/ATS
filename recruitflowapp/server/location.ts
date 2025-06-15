import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertLocationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { tenantSecurityMiddleware } from "./tenant";

export function setupLocationRoutes(app: Express) {
  // Get all locations for a company
  app.get('/api/company/locations', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).send('Unauthorized');
      }
      
      console.log(`Fetching locations for company ID: ${req.user.companyId}`);
      const locations = await storage.getLocationsByCompany(req.user.companyId);
      console.log(`Found ${locations.length} locations`);
      return res.json(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      return res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });
  
  // Get a specific location
  app.get('/api/company/locations/:id', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).send('Unauthorized');
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ error: 'Invalid location ID' });
      }
      
      const location = await storage.getLocationById(locationId);
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      // Ensure tenant security - user can only access locations from their company
      if (location.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      return res.json(location);
    } catch (error) {
      console.error('Error fetching location:', error);
      return res.status(500).json({ error: 'Failed to fetch location' });
    }
  });
  
  // Create a new location
  app.post('/api/company/locations', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).send('Unauthorized');
      }
      
      console.log('Creating location with request body:', req.body);
      
      // Validate the location data
      const locationData = insertLocationSchema.parse({
        ...req.body,
        companyId: req.user.companyId
      });
      
      console.log('Validated location data:', locationData);
      const location = await storage.createLocation(locationData);
      console.log('Created location:', location);
      return res.json(location);
    } catch (error) {
      console.error('Error creating location:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid location data', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to create location' });
    }
  });
  
  // Update a location
  app.put('/api/company/locations/:id', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).send('Unauthorized');
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ error: 'Invalid location ID' });
      }
      
      // Get the existing location to verify tenant ownership
      const existingLocation = await storage.getLocationById(locationId);
      if (!existingLocation) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      // Ensure tenant security - user can only update locations from their company
      if (existingLocation.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Validate the update data and ensure companyId is preserved
      const updateData = {
        ...req.body,
        companyId: req.user.companyId // Preserve the original company ID
      };
      
      const updatedLocation = await storage.updateLocation(locationId, updateData);
      return res.json(updatedLocation);
    } catch (error) {
      console.error('Error updating location:', error);
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid location data', details: error.errors });
      }
      return res.status(500).json({ error: 'Failed to update location' });
    }
  });
  
  // Delete a location
  app.delete('/api/company/locations/:id', tenantSecurityMiddleware, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).send('Unauthorized');
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ error: 'Invalid location ID' });
      }
      
      // Get the existing location to verify tenant ownership
      const existingLocation = await storage.getLocationById(locationId);
      if (!existingLocation) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      // Ensure tenant security - user can only delete locations from their company
      if (existingLocation.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await storage.deleteLocation(locationId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting location:', error);
      return res.status(500).json({ error: 'Failed to delete location' });
    }
  });
}