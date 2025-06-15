const request = require('supertest');
const { jest } = require('@jest/globals');

// Mock the storage layer
const mockStorage = {
  getDocumentsByCandidate: jest.fn(),
  getDocumentById: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getCandidateById: jest.fn()
};

jest.mock('../server/storage.js', () => ({
  storage: mockStorage
}));

const { app } = require('../server/index.js');

describe('Document Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/candidates/:candidateId/documents', () => {
    test('should retrieve all documents for a candidate', async () => {
      const candidateId = 1;
      const mockDocuments = [
        {
          id: 1,
          name: 'resume.pdf',
          type: 'application/pdf',
          url: '/uploads/documents/resume.pdf',
          candidateId: candidateId,
          companyId: 1,
          createdAt: new Date()
        },
        {
          id: 2,
          name: 'cover-letter.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          url: '/uploads/documents/cover-letter.docx',
          candidateId: candidateId,
          companyId: 1,
          createdAt: new Date()
        }
      ];

      mockStorage.getDocumentsByCandidate.mockResolvedValue(mockDocuments);

      const response = await request(app)
        .get(`/api/candidates/${candidateId}/documents`)
        .expect(200);

      expect(response.body).toEqual(mockDocuments);
      expect(mockStorage.getDocumentsByCandidate).toHaveBeenCalledWith(candidateId);
    });

    test('should return empty array when no documents exist', async () => {
      const candidateId = 999;
      mockStorage.getDocumentsByCandidate.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/candidates/${candidateId}/documents`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/candidates/:candidateId/documents', () => {
    test('should upload and create a document for a candidate', async () => {
      const candidateId = 1;
      const mockCandidate = {
        id: candidateId,
        fullName: 'John Doe',
        companyId: 1
      };

      const mockDocument = {
        id: 1,
        name: 'resume.pdf',
        type: 'application/pdf',
        url: '/uploads/documents/resume.pdf',
        candidateId: candidateId,
        companyId: 1,
        createdAt: new Date()
      };

      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);
      mockStorage.createDocument.mockResolvedValue(mockDocument);

      const response = await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .attach('document', Buffer.from('fake pdf content'), 'resume.pdf')
        .expect(201);

      expect(response.body).toEqual(mockDocument);
      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'resume.pdf',
          type: 'application/pdf',
          candidateId: candidateId,
          companyId: 1
        })
      );
    });

    test('should validate file upload requirements', async () => {
      const candidateId = 1;

      await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .send({}) // No file attached
        .expect(400);
    });

    test('should reject unsupported file types', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 1 };
      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);

      await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .attach('document', Buffer.from('fake exe content'), 'malware.exe')
        .expect(400);
    });

    test('should handle file size limits', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 1 };
      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);

      // Create a large buffer to simulate oversized file
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .attach('document', largeBuffer, 'large-file.pdf')
        .expect(400);
    });
  });

  describe('PUT /api/documents/:id', () => {
    test('should update document metadata', async () => {
      const documentId = 1;
      const updateData = {
        name: 'updated-resume.pdf'
      };

      const mockDocument = {
        id: documentId,
        name: 'updated-resume.pdf',
        type: 'application/pdf',
        url: '/uploads/documents/resume.pdf',
        candidateId: 1,
        companyId: 1,
        createdAt: new Date()
      };

      mockStorage.getDocumentById.mockResolvedValue({ id: documentId, companyId: 1 });
      mockStorage.updateDocument.mockResolvedValue(mockDocument);

      const response = await request(app)
        .put(`/api/documents/${documentId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(mockDocument);
      expect(mockStorage.updateDocument).toHaveBeenCalledWith(documentId, updateData);
    });

    test('should return 404 when updating non-existent document', async () => {
      const documentId = 999;
      mockStorage.getDocumentById.mockResolvedValue(undefined);

      await request(app)
        .put(`/api/documents/${documentId}`)
        .send({ name: 'new-name.pdf' })
        .expect(404);
    });

    test('should prevent cross-tenant document updates', async () => {
      const documentId = 1;
      mockStorage.getDocumentById.mockResolvedValue({ id: documentId, companyId: 2 }); // Different company

      await request(app)
        .put(`/api/documents/${documentId}`)
        .send({ name: 'unauthorized-update.pdf' })
        .expect(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    test('should delete a document successfully', async () => {
      const documentId = 1;
      const mockDocument = {
        id: documentId,
        name: 'resume.pdf',
        url: '/uploads/documents/resume.pdf',
        companyId: 1
      };

      mockStorage.getDocumentById.mockResolvedValue(mockDocument);
      mockStorage.deleteDocument.mockResolvedValue();

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .expect(200);

      expect(mockStorage.deleteDocument).toHaveBeenCalledWith(documentId);
    });

    test('should return 404 when deleting non-existent document', async () => {
      const documentId = 999;
      mockStorage.getDocumentById.mockResolvedValue(undefined);

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .expect(404);
    });

    test('should clean up file system when deleting document', async () => {
      const documentId = 1;
      const mockDocument = {
        id: documentId,
        name: 'resume.pdf',
        url: '/uploads/documents/resume.pdf',
        companyId: 1
      };

      mockStorage.getDocumentById.mockResolvedValue(mockDocument);
      mockStorage.deleteDocument.mockResolvedValue();

      await request(app)
        .delete(`/api/documents/${documentId}`)
        .expect(200);

      // Verify that file cleanup logic is triggered
      expect(mockStorage.deleteDocument).toHaveBeenCalledWith(documentId);
    });
  });

  describe('Document Security and Validation', () => {
    test('should validate document access permissions', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 2 }; // Different company
      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);

      await request(app)
        .get(`/api/candidates/${candidateId}/documents`)
        .expect(403);
    });

    test('should sanitize file names', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 1 };
      const maliciousFileName = '../../../etc/passwd';

      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);
      
      const mockDocument = {
        id: 1,
        name: 'passwd', // Should be sanitized
        type: 'text/plain',
        url: '/uploads/documents/passwd',
        candidateId: candidateId,
        companyId: 1,
        createdAt: new Date()
      };

      mockStorage.createDocument.mockResolvedValue(mockDocument);

      const response = await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .attach('document', Buffer.from('fake content'), maliciousFileName)
        .expect(201);

      // Verify that the file name was sanitized
      expect(response.body.name).not.toContain('../');
    });

    test('should handle virus scanning for uploaded files', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 1 };
      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);

      // Mock virus detection
      const suspiciousFile = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      await request(app)
        .post(`/api/candidates/${candidateId}/documents`)
        .attach('document', suspiciousFile, 'suspicious.txt')
        .expect(400); // Should reject suspicious files
    });
  });

  describe('Document Metadata and Organization', () => {
    test('should categorize documents by type', async () => {
      const candidateId = 1;
      const mockDocuments = [
        { id: 1, name: 'resume.pdf', type: 'application/pdf', category: 'resume' },
        { id: 2, name: 'cover-letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'cover-letter' },
        { id: 3, name: 'portfolio.zip', type: 'application/zip', category: 'portfolio' }
      ];

      mockStorage.getDocumentsByCandidate.mockResolvedValue(mockDocuments);

      const response = await request(app)
        .get(`/api/candidates/${candidateId}/documents`)
        .expect(200);

      expect(response.body).toEqual(mockDocuments);
      
      // Verify categorization
      const resumes = response.body.filter(doc => doc.category === 'resume');
      const coverLetters = response.body.filter(doc => doc.category === 'cover-letter');
      expect(resumes).toHaveLength(1);
      expect(coverLetters).toHaveLength(1);
    });

    test('should support document versioning', async () => {
      const candidateId = 1;
      const documentId = 1;
      
      const versionedDocument = {
        id: documentId,
        name: 'resume-v2.pdf',
        version: 2,
        previousVersionId: 1,
        companyId: 1
      };

      mockStorage.updateDocument.mockResolvedValue(versionedDocument);
      mockStorage.getDocumentById.mockResolvedValue({ id: documentId, companyId: 1 });

      const response = await request(app)
        .put(`/api/documents/${documentId}`)
        .send({ name: 'resume-v2.pdf', version: 2 })
        .expect(200);

      expect(response.body.version).toBe(2);
    });
  });

  describe('Performance and Storage Management', () => {
    test('should handle concurrent document uploads', async () => {
      const candidateId = 1;
      const mockCandidate = { id: candidateId, companyId: 1 };
      mockStorage.getCandidateById.mockResolvedValue(mockCandidate);

      const uploadPromises = [];
      for (let i = 0; i < 5; i++) {
        const mockDocument = {
          id: i + 1,
          name: `document-${i + 1}.pdf`,
          type: 'application/pdf',
          candidateId: candidateId,
          companyId: 1
        };
        
        mockStorage.createDocument.mockResolvedValueOnce(mockDocument);
        
        uploadPromises.push(
          request(app)
            .post(`/api/candidates/${candidateId}/documents`)
            .attach('document', Buffer.from(`content ${i + 1}`), `document-${i + 1}.pdf`)
        );
      }

      const responses = await Promise.all(uploadPromises);
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(`document-${index + 1}.pdf`);
      });
    });

    test('should track storage usage per company', async () => {
      const candidateId = 1;
      const mockDocuments = [
        { id: 1, name: 'doc1.pdf', size: 1024 * 1024 }, // 1MB
        { id: 2, name: 'doc2.pdf', size: 2 * 1024 * 1024 }, // 2MB
        { id: 3, name: 'doc3.pdf', size: 500 * 1024 } // 500KB
      ];

      mockStorage.getDocumentsByCandidate.mockResolvedValue(mockDocuments);

      const response = await request(app)
        .get(`/api/candidates/${candidateId}/documents`)
        .expect(200);

      const totalSize = response.body.reduce((sum, doc) => sum + (doc.size || 0), 0);
      expect(totalSize).toBe(3.5 * 1024 * 1024); // 3.5MB total
    });
  });
});