'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface GithubRepo {
  id: string;
  name: string;
  description: string;
  url: string;
  image: string;
}

export default function GithubRepoList() {
  const { toast } = useToast();
  const router = useRouter();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
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
      loadRepos();
    }
  }, [router, toast]);

  const loadRepos = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/github/repos`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch GitHub repositories');
      }
      const result: { success: boolean; data: GithubRepo[] } = await response.json();
      if (result.success) {
        setRepos(result.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load GitHub repositories',
        variant: 'destructive',
      });
    }
  };

  const handleAddAsProject = async (repo: GithubRepo) => {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          title: repo.name,
          description: repo.description,
          image: repo.image,
          rating: 'Not rated yet',
          stars: 0,
          links: [{ option: 'GitHub', value: repo.url }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add project');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Repository added as project successfully',
        });
      } else {
        throw new Error(result.error || 'Failed to add project');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add project',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-2">GitHub Repositories</h2>
      <ul className="space-y-2">
        {repos.map((repo) => (
          <li key={repo.id} className="flex justify-between items-center p-2 border-b">
            <div>
              <p><strong>{repo.name}</strong></p>
              <p className="text-sm text-gray-600">{repo.description}</p>
              <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                {repo.url}
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddAsProject(repo)}
            >
              Add as Project
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}