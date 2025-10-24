'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Code, MessageSquare, Users, Github } from 'lucide-react';
import ProjectList from './project-list';
import SkillList from './skill-list';
import CommentList from './comment-list';
import UserList from './user-list';
import GithubRepoList from './github-repo-list';
import { Metadata } from 'next';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
  title: 'Portfolio Admin Dashboard',
  description: 'Manage your portfolio projects, skills, comments, users, and GitHub repos',
};

interface Project {
  _id: string;
  title: string;
  description: string;
  image: string;
  rating: string;
  stars: number;
  links: { option: string; value: string }[];
}

interface Skill {
  _id: string;
  name: string;
  icon: string;
  percentage: number;
}

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

interface User {
  _id: string;
  username: string;
  email: string;
  profile: { nickname?: string; avatar?: string; portfolioName?: string };
  role: 'User' | 'Admin';
}

interface GithubRepo {
  id: string;
  name: string;
  description: string;
  url: string;
  image: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function PortfolioAdminPage() {
  const t = useTranslations('Admin');
  const [activeTab, setActiveTab] = useState('projects');

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('Portfolio Management')}</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger
            value="projects"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Briefcase size={20} />
            {t('Projects')}
          </TabsTrigger>
          <TabsTrigger
            value="skills"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Code size={20} />
            {t('Skills')}
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <MessageSquare size={20} />
            {t('Comments')}
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Users size={20} />
            {t('Users')}
          </TabsTrigger>
          <TabsTrigger
            value="github-repos"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Github size={20} />
            {t('GitHub Repos')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="mt-6">
          <ProjectList />
        </TabsContent>
        <TabsContent value="skills" className="mt-6">
          <SkillList />
        </TabsContent>
        <TabsContent value="comments" className="mt-6">
          <CommentList />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserList />
        </TabsContent>
        <TabsContent value="github-repos" className="mt-6">
          <GithubRepoList />
        </TabsContent>
      </Tabs>
    </div>
  );
}