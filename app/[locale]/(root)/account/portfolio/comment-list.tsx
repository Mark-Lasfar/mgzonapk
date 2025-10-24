'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Star } from 'lucide-react';

interface Comment {
  _id: string;
  projectId: string;
  projectTitle: string;
  userId: { username: string; email: string };
  rating: number;
  ratingText: string;
  text: string;
  timestamp: string;
  replies: { text: string; timestamp: string }[];
}

export default function CommentList() {
  const t = useTranslations('AccountPortfolio');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newReply, setNewReply] = useState<{ [key: string]: string }>({});

  const fetchComments = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setComments(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const handleReply = async (commentId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments/${commentId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: newReply[commentId] }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('replySuccess'));
        fetchComments();
        setNewReply({ ...newReply, [commentId]: '' });
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('deleteSuccess'));
        fetchComments();
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('comments')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {comments.map((comment) => (
            <Card key={comment._id}>
              <CardContent>
                <h3>{t('project')}: {comment.projectTitle}</h3>
                <p>{t('user')}: {comment.userId.username}</p>
                <div className="flex items-center gap-2">
                  <p>{t('rating')}:</p>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      fill={i < comment.rating ? 'yellow' : 'none'}
                      stroke={i < comment.rating ? 'yellow' : 'gray'}
                    />
                  ))}
                  <p>({comment.ratingText})</p>
                </div>
                <p>{t('comment')}: {comment.text}</p>
                <p>{t('date')}: {new Date(comment.timestamp).toLocaleString()}</p>
                {comment.replies.map((reply, index) => (
                  <p key={index}>
                    {t('reply')}: {reply.text} ({new Date(reply.timestamp).toLocaleString()})
                  </p>
                ))}
                <Input
                  placeholder={t('writeReply')}
                  value={newReply[comment._id] || ''}
                  onChange={(e) => setNewReply({ ...newReply, [comment._id]: e.target.value })}
                />
                <Button onClick={() => handleReply(comment._id)}>{t('reply')}</Button>
                <Button onClick={() => handleDelete(comment._id)} variant="destructive">
                  {t('delete')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}