const request = require('supertest');
const { jest } = require('@jest/globals');

// Mock the storage layer
const mockStorage = {
  getLocationsByCompany: jest.fn(),
  getLocationById: jest.fn(),
  createLocation: jest.fn(),
  updateLocation: jest.fn(),
  deleteLocation: jest.fn(),
  getJobsByLocation: jest.fn()
};

jest.mock('../server/storage.js', () => ({
  storage: mockStorage
}));

const { app } = require('../server/index.js');

describe('Location Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/company/locations', () => {
    test('should retrieve all locations for a company', async () => {
      const mockLocations = [
        {
          id: 1,
          name: 'Main Office',
          streetAddress: '123 Business St',
          city: 'San Francisco',
          county: 'San Francisco County',
          state: 'CA',
          zipCode: '94105',
          companyId: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          name: 'Remote Office',
          streetAddress: '456 Tech Ave',
          city: 'Austin',
          county: 'Travis County',
          state: 'TX',
          zipCode: '73301',
          companyId: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockStorage.getLocationsByCompany.mockResolvedValue(mockLocations);

      const response = await request(app)
        .get('/api/company/locations')
        .expect(200);

      expect(response.body).toEqual(mockLocations);
      expect(mockStorage.getLocationsByCompany).toHaveBeenCalledWith(1);
    });

    test('should return empty array when no locations exist', async () => {
      mockStorage.getLocationsByCompany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/company/locations')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/company/locations/:id', () => {
    test('should retrieve a specific location by ID', async () => {
      const mockLocation = {
        id: 1,
        name: 'Main Office',
        streetAddress: '123 Business St',
        city: 'San Francisco',
        county: 'San Francisco County',
        state: 'CA',
        zipCode: '94105',
        companyId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorage.getLocationById.mockResolvedValue(mockLocation);

      const response = await request(app)
        .get('/api/company/locations/1')
        .expect(200);

      expect(response.body).toEqual(mockLocation);
      expect(mockStorage.getLocationById).toHaveBeenCalledWith(1);
    });

    test('should return 404 when location not found', async () => {
      mockStorage.getLocationById.mockResolvedValue(undefined);

      await request(app)
        .get('/api/company/locations/999')
        .expect(404);

      expect(mockStorage.getLocationById).toHaveBeenCalledWith(999);
    });
  });

  describe('POST /api/company/locations', () => {
    test('should create a new location successfully', async () => {
      const newLocationData = {
        name: 'Branch Office',
        streetAddress: '789 Innovation Blvd',
        city: 'Seattle',
        county: 'King County',
        state: 'WA',
        zipCode: '98101'
      };

      const createdLocation = {
        id: 3,
        ...newLocationData,
        companyId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorage.createLocation.mockResolvedValue(createdLocation);

      const response = await request(app)
        .post('/api/company/locations')
        .send(newLocationData)
        .expect(201);

      expect(response.body).toEqual(createdLocation);
      expect(mockStorage.createLocation).toHaveBeenCalledWith({
        ...newLocationData,
        companyId: 1
      });
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        name: 'Incomplete Office'
        // Missing required fields
      };

      await request(app)
        .post('/api/company/locations')
        .send(incompleteData)
        .expect(400);
    });

    test('should handle duplicate location names gracefully', async () => {
      const duplicateLocationData = {
        name: 'Main Office', // Assuming this already exists
        streetAddress: '999 Duplicate St',
        city: 'Portland',
        county: 'Multnomah County',
        state: 'OR',
        zipCode: '97201'
      };

      mockStorage.createLocation.mockRejectedValue(new Error('Location name already exists'));

      await request(app)
        .post('/api/company/locations')
        .send(duplicateLocationData)
        .expect(500);
    });
  });

  describe('PUT /api/company/locations/:id', () => {
    test('should update an existing location', async () => {
      const updateData = {
        name: 'Updated Office Name',
        streetAddress: '123 Updated St',
        city: 'Updated City',
        county: 'Updated County',
        state: 'CA',
        zipCode: '90210'
      };

      const updatedLocation = {
        id: 1,
        ...updateData,
        companyId: 1,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date()
      };

      mockStorage.getLocationById.mockResolvedValue({ id: 1, companyId: 1 });
      mockStorage.updateLocation.mockResolvedValue(updatedLocation);

      const response = await request(app)
        .put('/api/company/locations/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(updatedLocation);
      expect(mockStorage.updateLocation).toHaveBeenCalledWith(1, updateData);
    });

    test('should return 404 when updating non-existent location', async () => {
      mockStorage.getLocationById.mockResolvedValue(undefined);

      await request(app)
        .put('/api/company/locations/999')
        .send({ name: 'Non-existent' })
        .expect(404);
    });

    test('should prevent cross-tenant location updates', async () => {
      mockStorage.getLocationById.mockResolvedValue({ id: 1, companyId: 2 }); // Different company

      await request(app)
        .put('/api/company/locations/1')
        .send({ name: 'Unauthorized Update' })
        .expect(403);
    });
  });

  describe('DELETE /api/company/locations/:id', () => {
    test('should delete a location successfully', async () => {
      mockStorage.getLocationById.mockResolvedValue({ id: 1, companyId: 1 });
      mockStorage.getJobsByLocation.mockResolvedValue([]); // No jobs using this location
      mockStorage.deleteLocation.mockResolvedValue();

      await request(app)
        .delete('/api/company/locations/1')
        .expect(200);

      expect(mockStorage.deleteLocation).toHaveBeenCalledWith(1);
    });

    test('should prevent deletion when location is in use by jobs', async () => {
      mockStorage.getLocationById.mockResolvedValue({ id: 1, companyId: 1 });
      mockStorage.getJobsByLocation.mockResolvedValue([
        { id: 1, title: 'Software Engineer', locationId: 1 }
      ]); // Jobs using this location

      await request(app)
        .delete('/api/company/locations/1')
        .expect(400);

      expect(mockStorage.deleteLocation).not.toHaveBeenCalled();
    });

    test('should return 404 when deleting non-existent location', async () => {
      mockStorage.getLocationById.mockResolvedValue(undefined);

      await request(app)
        .delete('/api/company/locations/999')
        .expect(404);
    });
  });

  describe('Location Data Validation', () => {
    test('should validate US state codes', async () => {
      const invalidStateData = {
        name: 'Invalid State Office',
        streetAddress: '123 Test St',
        city: 'Test City',
        county: 'Test County',
        state: 'INVALID', // Invalid state code
        zipCode: '12345'
      };

      await request(app)
        .post('/api/company/locations')
        .send(invalidStateData)
        .expect(400);
    });

    test('should validate zip code format', async () => {
      const invalidZipData = {
        name: 'Invalid Zip Office',
        streetAddress: '123 Test St',
        city: 'Test City',
        county: 'Test County',
        state: 'CA',
        zipCode: 'INVALID' // Invalid zip code
      };

      await request(app)
        .post('/api/company/locations')
        .send(invalidZipData)
        .expect(400);
    });

    test('should accept valid location data formats', async () => {
      const validLocationData = {
        name: 'Valid Office',
        streetAddress: '123 Valid St',
        city: 'Valid City',
        county: 'Valid County',
        state: 'CA',
        zipCode: '90210'
      };

      const createdLocation = {
        id: 1,
        ...validLocationData,
        companyId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorage.createLocation.mockResolvedValue(createdLocation);

      const response = await request(app)
        .post('/api/company/locations')
        .send(validLocationData)
        .expect(201);

      expect(response.body).toEqual(createdLocation);
    });
  });

  describe('Multi-tenant Location Isolation', () => {
    test('should only return locations for the active tenant', async () => {
      const companyALocations = [
        { id: 1, name: 'Company A Office 1', companyId: 1 },
        { id: 2, name: 'Company A Office 2', companyId: 1 }
      ];

      mockStorage.getLocationsByCompany.mockResolvedValue(companyALocations);

      const response = await request(app)
        .get('/api/company/locations')
        .expect(200);

      expect(response.body).toEqual(companyALocations);
      expect(mockStorage.getLocationsByCompany).toHaveBeenCalledWith(1);
    });

    test('should prevent access to other company locations', async () => {
      mockStorage.getLocationById.mockResolvedValue({ id: 1, companyId: 2 }); // Different company

      await request(app)
        .get('/api/company/locations/1')
        .expect(403);
    });
  });
});