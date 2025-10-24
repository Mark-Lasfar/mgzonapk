'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface Comment {
  _id: string;
  projectId: string;
  projectTitle: string;
  userId: { username: string; email: string };
  rating: number;
  text: string;
  timestamp: string;
  replies: { text: string; timestamp: string }[];
}

export default function CommentList() {
  const { toast } = useToast();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyForm, setReplyForm] = useState({ commentId: '', text: '' });
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    setUserToken(token);
    if (!token) {
      toast({
        title: 'Error',
        description: 'No authentication token found. Please log in.',
        variant: 'destructive',
      });
      router.push('/sign-in');
    } else {
      loadComments();
    }
  }, [router, toast]);

  const loadComments = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      const result: { success: boolean; data: Comment[] } = await response.json();
      if (result.success) {
        setComments(result.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load comments',
        variant: 'destructive',
      });
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToken) {
      toast({
        title: 'Error',
        description: 'Authentication required. Please log in.',
        variant: 'destructive',
      });
      router.push('/sign-in');
      return;
    }

    const { commentId, text } = replyForm;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add reply');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Reply added successfully',
        });
        setReplyForm({ commentId: '', text: '' });
        await loadComments();
      } else {
        throw new Error(result.error || 'Failed to add reply');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add reply',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!userToken) {
      toast({
        title: 'Error',
        description: 'Authentication required. Please log in.',
        variant: 'destructive',
      });
      router.push('/sign-in');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete comment');
      }
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Comment deleted successfully',
        });
        await loadComments();
      } else {
        throw new Error(result.error || 'Failed to delete comment');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-2">Manage Comments</h2>
      <ul className="space-y-4">
        {comments.map((comment) => (
          <li key={comment._id} className="p-4 border rounded">
            <div className="flex justify-between items-center">
              <div>
                <p><strong>Project:</strong> {comment.projectTitle}</p>
                <p><strong>User:</strong> {comment.userId.username}</p>
                <p><strong>Rating:</strong> {comment.rating}/5</p>
                <p><strong>Comment:</strong> {comment.text}</p>
                <p><strong>Posted:</strong> {new Date(comment.timestamp).toLocaleString()}</p>
                {comment.replies.length > 0 && (
                  <div>
                    <strong>Replies:</strong>
                    <ul className="ml-4">
                      {comment.replies.map((reply, index) => (
                        <li key={index} className="text-sm">
                          {reply.text} <em>({new Date(reply.timestamp).toLocaleString()})</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyForm({ ...replyForm, commentId: comment._id })}
                >
                  Reply
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(comment._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            {replyForm.commentId === comment._id && (
              <form onSubmit={handleReplySubmit} className="mt-4 space-y-2">
                <Textarea
                  placeholder="Reply text"
                  value={replyForm.text}
                  onChange={(e) => setReplyForm({ ...replyForm, text: e.target.value })}
                  className="w-full"
                />
                <Button type="submit">Submit Reply</Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}