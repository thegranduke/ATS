import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react';
import { User } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/user-avatar';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, Upload, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface AvatarUpdateData extends Partial<User> {
  pendingColorUpdate?: boolean;
  _forceAvatarRefresh?: boolean;
}

interface AvatarEditorProps {
  user: User;
  onUpdate: (updatedUser: AvatarUpdateData) => void;
}

const AVATAR_COLORS = [
  '#F87171', // Red
  '#FB923C', // Orange
  '#FBBF24', // Amber
  '#A3E635', // Lime
  '#34D399', // Emerald
  '#22D3EE', // Cyan
  '#38BDF8', // Light Blue
  '#818CF8', // Indigo
  '#A78BFA', // Violet
  '#F472B6', // Pink
];

export default function AvatarEditor({ user, onUpdate }: AvatarEditorProps) {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState<string>(user.avatarColor || AVATAR_COLORS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutation for updating avatar color
  const updateColorMutation = useMutation({
    mutationFn: async (color: string) => {
      const response = await apiRequest('PATCH', '/api/user/avatar', { avatarColor: color });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Avatar color updated',
        description: 'Your avatar color has been updated successfully.',
      });
      onUpdate({ avatarColor: selectedColor });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update avatar color.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for uploading avatar image
  const uploadAvatarMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/user/avatar/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated successfully.',
      });
      
      // Create a forced updated URL with timestamp to avoid caching issues
      const updatedUrl = data.avatarUrl + (data.avatarUrl.includes('?') ? '&' : '?') + 'refresh=' + Date.now();
      
      // Update with the new avatar URL
      onUpdate({ 
        avatarUrl: updatedUrl,
        // Add a special refresh flag to force UI refresh
        _forceAvatarRefresh: true
      });
      
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload avatar image.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for deleting avatar
  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/user/avatar', {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Avatar removed',
        description: 'Your profile picture has been removed.',
      });
      
      // Update with the new avatar URL (null) and force refresh
      onUpdate({ 
        avatarUrl: null,
        _forceAvatarRefresh: true 
      });
      
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove avatar image.',
        variant: 'destructive',
      });
    },
  });

  // Effect to notify parent component when color changes
  useEffect(() => {
    if (selectedColor !== user.avatarColor) {
      onUpdate({ avatarColor: selectedColor, pendingColorUpdate: true });
    }
  }, [selectedColor, user.avatarColor, onUpdate]);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    // Not immediately updating the color with API call
    // It will be updated when the profile form is submitted
  };

  const handleAvatarUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      uploadAvatar(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      uploadAvatar(file);
    }
  };

  const uploadAvatar = (file: File) => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, GIF, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    // Create form data and upload
    const formData = new FormData();
    formData.append('avatar', file);
    uploadAvatarMutation.mutate(formData);
  };

  const handleRemoveAvatar = () => {
    if (user.avatarUrl) {
      deleteAvatarMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center space-x-6">
        <div className="relative">
          <UserAvatar 
            user={user} 
            size="xl" 
            className="h-24 w-24" 
            forceRefresh={uploadAvatarMutation.isSuccess || deleteAvatarMutation.isSuccess}
          />
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-0 right-0 rounded-full bg-white"
            onClick={() => setIsDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-medium">Profile Picture</h3>
          <p className="text-sm text-gray-500">
            {user.avatarUrl 
              ? 'Upload a new avatar or change your avatar color'
              : 'Upload a photo or select a color for your avatar'}
          </p>
          <div className="flex space-x-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Image
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Profile Picture</DialogTitle>
                  <DialogDescription>
                    Upload a new profile picture. Drag and drop or click to browse.
                  </DialogDescription>
                </DialogHeader>
                <div
                  className={`mt-4 border-2 border-dashed rounded-lg p-12 text-center ${
                    isDragging ? 'border-primary bg-primary/10' : 'border-gray-300'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleAvatarUploadClick}
                >
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag and drop your image here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports JPEG, PNG, GIF, WebP up to 5MB
                    </p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  {user.avatarUrl && (
                    <Button
                      variant="destructive"
                      onClick={handleRemoveAvatar}
                      disabled={deleteAvatarMutation.isPending}
                    >
                      {deleteAvatarMutation.isPending ? (
                        <span className="flex items-center">
                          <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                          Removing...
                        </span>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Image
                        </>
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {user.avatarUrl && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={deleteAvatarMutation.isPending}
              >
                {deleteAvatarMutation.isPending ? 
                  <span className="flex items-center">
                    <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                    Removing...
                  </span> 
                  : "Remove Image"
                }
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-base font-medium mb-3">Avatar Color</h3>
          <div className="flex flex-wrap gap-3">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full relative transition-all ${
                  selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                aria-label={`Select ${color} as avatar color`}
              >
                {selectedColor === color && (
                  <Check className="h-4 w-4 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}