'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface GithubRepo {
  id: string;
  name: string;
  description: string;
  url: string;
  image: string;
}

export default function GithubRepoList() {
  const t = useTranslations('AccountPortfolio');
  const locale = useLocale();
  const [repos, setRepos] = useState<GithubRepo[]>([]);

  const fetchRepos = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/github/repos`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setRepos(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleLinkGithub = () => {
    const redirectUri = `${window.location.origin}/${locale}/auth/callback`; // المسار الجديد
    const successRedirect = `/${locale}/account/portfolio`;
    const githubAuthUrl = `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/auth/github?redirect_uri=${encodeURIComponent(
      redirectUri
    )}&success_redirect=${encodeURIComponent(successRedirect)}`;

    window.location.href = githubAuthUrl;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('githubRepos')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLinkGithub} className="mb-4">
          {t('linkGithub')}
        </Button>
        <div className="grid gap-4">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardContent>
                <h3>{repo.name}</h3>
                <p>{repo.description}</p>
                <a href={repo.url} target="_blank" rel="noopener noreferrer">
                  {t('viewOnGithub')}
                </a>
                {repo.image && <img src={repo.image} alt={repo.name} className="w-24 h-24" />}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}