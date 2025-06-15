import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserAvatar from '@/components/user-avatar';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { formatDistanceToNow } from 'date-fns';

// Custom types for comments
interface CommentUser {
  id: number;
  fullName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}

interface Comment {
  id: number;
  content: string;
  htmlContent: string;
  userId: number;
  candidateId: number;
  companyId: number;
  mentionedUserIds: number[];
  createdAt: string;
  updatedAt: string;
  userFullName: string;
  userAvatarUrl: string | null;
  userAvatarColor: string | null;
}

interface CommentsTabProps {
  candidateId: number;
}

export function CommentsTab({ candidateId }: CommentsTabProps) {
  const [comment, setComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<number[]>([]);
  const quillRef = useRef<ReactQuill>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company users for @mentions
  const { data: companyUsers = [] } = useQuery<CommentUser[]>({
    queryKey: ['/api/users'],
    enabled: !!user,
  });

  // Fetch comments for this candidate
  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: [`/api/candidates/${candidateId}/comments`],
    enabled: !!candidateId,
  });

  // Mutation to post a new comment
  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { content: string; htmlContent: string; mentionedUserIds: number[] }) => {
      const response = await fetch(`/api/candidates/${candidateId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to post comment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Clear form and refetch comments
      setComment('');
      setMentionedUsers([]);
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidateId}/comments`] });
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been added successfully.',
      });
    },
    onError: (error) => {
      console.error('Failed to add comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add your comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Setup Quill modules with custom mention handling
  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comment.trim()) {
      toast({
        title: 'Empty comment',
        description: 'Please enter a comment before submitting.',
        variant: 'destructive',
      });
      return;
    }

    // Get HTML content from Quill
    const htmlContent = quillRef.current?.getEditor().root.innerHTML || '';
    
    createCommentMutation.mutate({
      content: comment,
      htmlContent,
      mentionedUserIds: mentionedUsers
    });
  };

  // Parse mentions from the text
  const parseMentions = useCallback((text: string) => {
    if (!companyUsers || !text || !Array.isArray(companyUsers)) return [];

    const mentionedIds: number[] = [];
    companyUsers.forEach((user: CommentUser) => {
      // Look for @Full Name pattern
      if (user && user.fullName && text.includes(`@${user.fullName}`)) {
        mentionedIds.push(user.id);
      }
    });

    return mentionedIds;
  }, [companyUsers]);

  // Update mentioned users when comment text changes
  useEffect(() => {
    setMentionedUsers(parseMentions(comment));
  }, [comment, parseMentions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments & Mentions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Comment list */}
          {isLoading ? (
            <div className="text-center">Loading comments...</div>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment: Comment) => (
                <div key={comment.id} className="flex gap-4">
                  <UserAvatar 
                    user={{
                      avatarUrl: comment.userAvatarUrl,
                      avatarColor: comment.userAvatarColor,
                      fullName: comment.userFullName
                    }}
                    size="sm"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{comment.userFullName}</div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div 
                      dangerouslySetInnerHTML={{ __html: comment.htmlContent }} 
                      className="prose prose-sm max-w-none text-gray-700 mt-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">No comments yet. Be the first to comment!</div>
          )}

          {/* Comment form */}
          <form onSubmit={handleSubmit} className="space-y-3 mt-6">
            <div className="border rounded-md">
              <ReactQuill
                ref={quillRef}
                value={comment}
                onChange={setComment}
                modules={quillModules}
                placeholder="Add your comment..."
                theme="snow"
              />
            </div>
            {companyUsers && companyUsers.length > 0 && (
              <div className="text-sm text-gray-500">
                Tip: Type @ to mention a team member
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={createCommentMutation.isPending || !comment.trim()}
              >
                {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}