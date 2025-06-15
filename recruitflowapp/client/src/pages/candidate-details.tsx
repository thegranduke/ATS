import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/dashboard-sidebar";
import CandidateForm from "@/components/candidate-form";
import { 
  User, Mail, Phone, FileText, Briefcase, Calendar, Edit, Trash, ExternalLink,
  Upload, Eye, FileX, File as FileIcon, MessageSquare
} from "lucide-react";
import { CommentsTab } from "@/components/comments-tab";

// Document type for working with uploaded files
interface DocumentFile {
  id: number;
  name: string;
  type: string;
  size?: number;
  objectKey?: string; // Legacy field, still included for backward compatibility
  candidateId: number;
  companyId?: number;
  createdAt?: string;
  uploadedAt?: string; // For backward compatibility
  url: string;
  documentUrl?: string; // Alias for url, for backward compatibility
}

// File size formatter
const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Document uploader component
const DocumentUploader = ({ candidateId }: { candidateId: number }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/candidates/${candidateId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upload document');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document uploaded",
        description: "The document has been successfully uploaded.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/documents`] });
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('document', file);
    formData.append('name', file.name);
    
    uploadMutation.mutate(formData);
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.ppt,.pptx,.csv,.json,.zip"
      />
      <Button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <span className="flex items-center">
            <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
            Uploading...
          </span>
        ) : (
          <span className="flex items-center">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </span>
        )}
      </Button>
    </div>
  );
};

// Document viewer component
const DocumentViewer = ({ candidateId }: { candidateId: number }) => {
  const [selectedDocument, setSelectedDocument] = useState<DocumentFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Query for documents
  const {
    data: documents = [],
    isLoading: isLoadingDocuments,
    isError,
    error
  } = useQuery({
    queryKey: [`/api/candidates/${candidateId}/documents`],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}/documents`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch documents");
      }
      return res.json();
    },
    enabled: !!candidateId
  });

  // Get candidate data to access the resume URL
  const {
    data: candidate,
    isLoading: isLoadingCandidate,
  } = useQuery<any>({
    queryKey: ["/api/candidates", candidateId.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch candidate details");
      }
      return res.json();
    },
    enabled: !!candidateId
  });

  // Set the resume as the default selected document if available
  useEffect(() => {
    if (candidate && candidate.resumeUrl && !selectedDocument) {
      setSelectedDocument({
        id: 0, // We use 0 to indicate this is the main resume
        name: "Resume",
        type: getFileTypeFromUrl(candidate.resumeUrl),
        size: 0, // Size unknown
        candidateId: candidateId,
        createdAt: candidate.createdAt,
        url: candidate.resumeUrl,
        documentUrl: candidate.resumeUrl // For backward compatibility
      });
    } else if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
    }
  }, [candidate, documents, selectedDocument, candidateId]);

  // Get file type from URL (basic detection)
  const getFileTypeFromUrl = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase() || '';
    if (extension === 'pdf') return 'application/pdf';
    if (['doc', 'docx'].includes(extension)) return 'application/msword';
    if (['xls', 'xlsx'].includes(extension)) return 'application/vnd.ms-excel';
    if (['ppt', 'pptx'].includes(extension)) return 'application/vnd.ms-powerpoint';
    if (extension === 'txt') return 'text/plain';
    return 'application/octet-stream';
  };

  // Render document content based on its type
  const renderDocumentContent = () => {
    if (!selectedDocument) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          <FileX className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
          <p>No document selected</p>
          <p className="text-sm">Select a document from the list below</p>
        </div>
      );
    }

    // Log document details for debugging
    console.log("Document details:", {
      id: selectedDocument.id,
      name: selectedDocument.name,
      type: selectedDocument.type,
      url: selectedDocument.url,
      documentUrl: selectedDocument.documentUrl,
      size: selectedDocument.size
    });

    const type = selectedDocument.type.toLowerCase();
    const documentUrl = selectedDocument.url || selectedDocument.documentUrl || '';
    
    // Check for problematic URL patterns
    const isFileProtocol = documentUrl.startsWith('file://');
    const isHttpUrl = documentUrl.startsWith('http://');
    const isHttpsUrl = documentUrl.startsWith('https://');
    const isRelativePath = !isFileProtocol && !isHttpUrl && !isHttpsUrl;
    
    console.log("URL analysis:", {
      url: documentUrl,
      isFileProtocol,
      isHttpUrl, 
      isHttpsUrl,
      isRelativePath
    });
    
    // For PDF files
    if (type.includes('pdf')) {
      // Instead of using iframe, we'll create a direct link to view the PDF
      // in a new tab, which avoids Chrome's security restrictions
      console.log("PDF detected, providing viewer interface");
      
      return (
        <div className="h-[600px] w-full flex flex-col items-center justify-center bg-gray-50">
          <div className="text-center mb-8">
            <FileIcon className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-medium">{selectedDocument.name}</h3>
            <p className="text-sm text-muted-foreground">PDF Document</p>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={() => {
                const url = selectedDocument.url || selectedDocument.documentUrl;
                console.log("Opening PDF in new tab:", url);
                window.open(url, '_blank');
              }}
              size="lg"
              className="flex items-center"
            >
              <Eye className="mr-2 h-5 w-5" />
              View Document
            </Button>
            
            <p className="text-xs text-center text-muted-foreground max-w-md">
              For security reasons, PDF documents will open in a new tab for better viewing experience.
            </p>
          </div>
        </div>
      );
    }
    
    // For MS Word documents
    if (type.includes('msword') || type.includes('officedocument.wordprocessingml')) {
      console.log("Word document detected, providing viewer interface");
      
      return (
        <div className="h-[600px] w-full flex flex-col items-center justify-center bg-gray-50">
          <div className="text-center mb-8">
            <FileText className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium">{selectedDocument.name}</h3>
            <p className="text-sm text-muted-foreground">Word Document</p>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={() => {
                const url = selectedDocument.url || selectedDocument.documentUrl;
                console.log("Opening Word document in new tab:", url);
                window.open(url, '_blank');
              }}
              size="lg"
              className="flex items-center"
              variant="outline"
            >
              <Eye className="mr-2 h-5 w-5" />
              View Document
            </Button>
            
            <p className="text-xs text-center text-muted-foreground max-w-md">
              For security reasons, documents will open in a new tab for better viewing experience.
            </p>
          </div>
        </div>
      );
    }
    
    // For other documents - provide download link
    return (
      <div className="py-8 text-center">
        <div className="mb-4">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-2" />
          <p className="text-lg font-semibold">{selectedDocument.name}</p>
          <p className="text-sm text-muted-foreground">
            {selectedDocument.type.split('/')[1]?.toUpperCase() || selectedDocument.type}
            {selectedDocument.size && selectedDocument.size > 0 ? ` • ${formatFileSize(selectedDocument.size)}` : ''}
          </p>
        </div>
        <p className="mb-4">This document type cannot be previewed directly in the browser.</p>
        <Button
          onClick={() => {
            const url = selectedDocument.url || selectedDocument.documentUrl;
            console.log("Opening document from preview:", url);
            window.open(url, '_blank');
          }}
          className="mx-auto"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Document
        </Button>
      </div>
    );
  };

  if (isLoadingDocuments || isLoadingCandidate) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-destructive">
        <p>Error loading documents: {error?.message || "Unknown error"}</p>
      </div>
    );
  }

  // Get all documents including the resume (if available)
  const allDocuments = [...documents];
  if (candidate?.resumeUrl) {
    const resumeAlreadyInList = allDocuments.some(doc => 
      doc.documentUrl === candidate.resumeUrl || 
      (doc.name.toLowerCase().includes('resume') && doc.candidateId === candidateId)
    );
    
    if (!resumeAlreadyInList) {
      allDocuments.unshift({
        id: 0, // We use 0 to indicate this is the main resume
        name: "Resume",
        type: getFileTypeFromUrl(candidate.resumeUrl),
        size: 0, // Size unknown
        candidateId: candidateId,
        createdAt: candidate.createdAt,
        url: candidate.resumeUrl,
        documentUrl: candidate.resumeUrl // For backward compatibility
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Document viewer */}
      <div className="bg-white border rounded-md overflow-hidden">
        {renderDocumentContent()}
      </div>
      
      {/* Document list */}
      <div className="rounded-md border">
        <div className="p-4 border-b">
          <h3 className="font-medium">All Documents</h3>
        </div>
        <div className="divide-y">
          {allDocuments.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              <p>No documents available</p>
            </div>
          ) : (
            allDocuments.map((doc) => (
              <div 
                key={doc.id || doc.documentUrl}
                className={`p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                  selectedDocument?.documentUrl === doc.documentUrl ? 'bg-gray-50' : ''
                }`}
                onClick={() => setSelectedDocument(doc)}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.type.split('/')[1]?.toUpperCase() || doc.type}
                      {doc.size && doc.size > 0 ? ` • ${formatFileSize(doc.size)}` : ''}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(doc.url || doc.documentUrl, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Document list component with edit/delete functionality
const DocumentList = ({ candidateId }: { candidateId: number }) => {
  const [documentToEdit, setDocumentToEdit] = useState<DocumentFile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentFile | null>(null);
  const [newName, setNewName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for documents
  const {
    data: documents = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: [`/api/candidates/${candidateId}/documents`],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${candidateId}/documents`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch documents");
      }
      return res.json();
    },
    enabled: !!candidateId
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number, name: string }) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update document');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document updated",
        description: "The document has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/documents`] });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update document. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete document');
      }

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/documents`] });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEdit = (document: DocumentFile) => {
    setDocumentToEdit(document);
    setNewName(document.name);
    setEditDialogOpen(true);
  };

  const handleDelete = (document: DocumentFile) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const confirmEdit = () => {
    if (documentToEdit) {
      updateDocumentMutation.mutate({ id: documentToEdit.id, name: newName });
    }
  };

  const confirmDelete = () => {
    if (documentToDelete) {
      deleteDocumentMutation.mutate(documentToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-4 text-destructive">
        <p>Error loading documents: {error?.message || "Unknown error"}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <FileX className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
        <p>No documents uploaded yet</p>
        <p className="text-sm">Upload documents using the button above</p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc: DocumentFile) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.name}</TableCell>
                <TableCell>{doc.type.split('/')[1]?.toUpperCase() || doc.type}</TableCell>
                <TableCell>{formatFileSize(doc.size)}</TableCell>
                <TableCell>
                  {doc.uploadedAt || doc.createdAt ? new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : 'Unknown'}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                    const url = doc.url || doc.documentUrl;
                    console.log("Opening document in new tab:", url);
                    window.open(url, '_blank');
                  }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(doc)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Document Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update the document name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmEdit}
              disabled={updateDocumentMutation.isPending || !newName}
            >
              {updateDocumentMutation.isPending ? (
                <span className="flex items-center">
                  <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                  Saving...
                </span>
              ) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteDocumentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocumentMutation.isPending ? (
                <span className="flex items-center">
                  <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                  Deleting...
                </span>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


export default function CandidateDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const candidateId = parseInt(id);

  // Query for candidate details
  const {
    data: candidate,
    isLoading,
    isError,
    error,
    refetch: refetchCandidate
  } = useQuery({
    queryKey: ["/api/candidates", id],
    queryFn: async () => {
      const res = await fetch(`/api/candidates/${id}`, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch candidate details");
      }
      return res.json();
    },
    enabled: !!user && !!id,
  });

  // Query for jobs
  const {
    data: jobs = [],
    isLoading: isLoadingJobs
  } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });

  // Initialize notes and status when candidate data is loaded
  if (candidate && notes === "" && status === "") {
    setNotes(candidate.notes || "");
    setStatus(candidate.status);
  }

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/candidates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidate deleted",
        description: "The candidate has been successfully deleted.",
      });
      navigate("/candidates");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete candidate",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update candidate notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async () => {
      const updatedCandidate = { ...candidate, notes };
      const response = await apiRequest("PUT", `/api/candidates/${id}`, updatedCandidate);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", id] });
      toast({
        title: "Notes updated",
        description: "Candidate notes have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update notes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update candidate status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      const updatedCandidate = { ...candidate, status };
      const response = await apiRequest("PUT", `/api/candidates/${id}`, updatedCandidate);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Status updated",
        description: `Candidate status updated to ${status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  // Get job title by id
  const getJobTitle = (jobId: number) => {
    const job = jobs.find((job: any) => job.id === jobId);
    return job ? job.title : "Unknown Position";
  };

  // Status badge variants
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "new":
        return "default";
      case "screening":
      case "interview":
      case "offer":
        return "secondary";
      case "hired":
        return "success";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <DashboardSidebar>
        <div className="flex justify-center items-center h-96">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardSidebar>
    );
  }

  if (isError) {
    return (
      <DashboardSidebar>
        <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-destructive mb-2">Error loading candidate details</h2>
              <p className="text-destructive">{error?.message || "Please try again later."}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/candidates")}
              >
                Return to Candidates
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardSidebar>
    );
  }

  return (
    <DashboardSidebar>
      <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 flex items-center">
              {candidate.fullName}
              <Badge className="ml-3" variant={getStatusVariant(candidate.status)}>
                {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
              </Badge>
            </h2>
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Mail className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                {candidate.email}
              </div>
              {candidate.phone && (
                <div className="mt-2 flex items-center text-sm text-gray-500">
                  <Phone className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                  {candidate.phone}
                </div>
              )}
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Calendar className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                Applied on {formatDate(candidate.createdAt)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4 space-x-2">
            <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="inline-flex items-center">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Edit Candidate</DialogTitle>
                  <DialogDescription>
                    Update the candidate information for {candidate.fullName}.
                  </DialogDescription>
                </DialogHeader>
                <CandidateForm 
                  candidateData={candidate} 
                  isEdit={true} 
                  candidateId={candidateId} 
                  jobs={jobs}
                  onSuccess={() => {
                    setOpenEditDialog(false);
                    refetchCandidate();
                  }} 
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="inline-flex items-center">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this candidate
                    from your records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteCandidateMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteCandidateMutation.isPending ? 
                      <span className="flex items-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Deleting...
                      </span> 
                      : "Delete"
                    }
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mt-6 md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Candidate Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <div className="mt-1 flex items-center">
                    <User className="mr-2 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{candidate.fullName}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <div className="mt-1 flex items-center">
                    <Mail className="mr-2 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{candidate.email}</span>
                  </div>
                </div>

                {candidate.phone && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                    <div className="mt-1 flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-sm">{candidate.phone}</span>
                    </div>
                  </div>
                )}

                {candidate.jobId && !isLoadingJobs && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Applied for</h3>
                    <div className="mt-1 flex items-center">
                      <Briefcase className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-sm">{getJobTitle(candidate.jobId)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Applied on</h3>
                  <div className="mt-1 flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatDate(candidate.createdAt)}</span>
                  </div>
                </div>

                {candidate.resumeUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Resume</h3>
                    <div className="mt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => window.open(candidate.resumeUrl, '_blank')}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Resume
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="mt-1">
                    <Select
                      value={status}
                      onValueChange={(value) => {
                        setStatus(value);
                        // Update status when changed
                        if (value !== candidate.status) {
                          setTimeout(() => {
                            updateStatusMutation.mutate();
                          }, 0);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="screening">Screening</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="offer">Offer</SelectItem>
                        <SelectItem value="hired">Hired</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 md:mt-0 md:col-span-2">
            <Tabs defaultValue="notes" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Add notes about this candidate..."
                      className="min-h-[200px]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <Button
                      className="mt-4"
                      size="sm"
                      onClick={() => updateNotesMutation.mutate()}
                      disabled={updateNotesMutation.isPending}
                    >
                      {updateNotesMutation.isPending ? 
                        <span className="flex items-center">
                          <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                          Saving...
                        </span> 
                        : "Save Notes"
                      }
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline">
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flow-root">
                      <ul role="list" className="-mb-8">
                        <li>
                          <div className="relative pb-8">
                            <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"></span>
                            <div className="relative flex items-start space-x-3">
                              <div>
                                <div className="relative px-1">
                                  <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center ring-8 ring-white">
                                    <Calendar className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 py-1.5">
                                <div className="text-sm text-gray-500">
                                  <span className="font-medium text-gray-900">Application received</span>
                                </div>
                                <div className="mt-1 text-sm text-gray-500">
                                  {formatDate(candidate.createdAt)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>

                        {/* Future enhancement: Add status change log entries here */}
                        <li>
                          <div className="relative pb-8">
                            <div className="relative flex items-start space-x-3">
                              <div>
                                <div className="relative px-1">
                                  <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center ring-8 ring-white">
                                    <User className="h-4 w-4 text-gray-500" />
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 py-1.5">
                                <div className="text-sm text-gray-500">
                                  <span className="font-medium text-gray-900">Current status: {candidate.status}</span>
                                </div>
                                <div className="mt-1 text-sm text-gray-500">
                                  Update the status to track the candidate's progress
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="comments">
                <CommentsTab candidateId={candidateId} />
              </TabsContent>
              <TabsContent value="documents">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Documents</CardTitle>
                    <DocumentUploader candidateId={candidateId} />
                  </CardHeader>
                  <CardContent>
                    <DocumentList candidateId={candidateId} />
                  </CardContent>
                </Card>
              </TabsContent>
              

            </Tabs>
          </div>
        </div>
      </div>
    </DashboardSidebar>
  );
}