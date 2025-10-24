'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Briefcase,
  Code,
  MessageSquare,
  Github,
  Bell,
  User,
  Book,
  Download,
  MessageCircle,
  Search,
} from 'lucide-react';
import ProjectList from './project-list';
import SkillList from './skill-list';
import CommentList from './comment-list';
import GithubRepoList from './github-repo-list';
import NotificationList from './notification-list';
import ProfilePicture from './profile-picture';
import EducationList from './education-list';
import ContactInfo from './contact-info';
import DocxExport from './docx-export';
import AIChat from './ai-chat';
import UserSearch from './user-search';

interface PortfolioManagementPageClientProps {
  locale: string;
}

export default function PortfolioManagementPageClient({ locale }: PortfolioManagementPageClientProps) {
  const t = useTranslations('AccountPortfolio');
  const [activeTab, setActiveTab] = useState('projects');

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">{t('title')}</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger
            value="projects"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Briefcase size={20} />
            {t('projects')}
          </TabsTrigger>
          <TabsTrigger
            value="skills"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Code size={20} />
            {t('skills')}
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <MessageSquare size={20} />
            {t('comments')}
          </TabsTrigger>
          <TabsTrigger
            value="github-repos"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Github size={20} />
            {t('githubRepos')}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Bell size={20} />
            {t('notifications')}
          </TabsTrigger>
          <TabsTrigger
            value="profile-picture"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <User size={20} />
            {t('profilePicture')}
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Book size={20} />
            {t('education')}
          </TabsTrigger>
          <TabsTrigger
            value="contact-info"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <User size={20} />
            {t('contactInfo')}
          </TabsTrigger>
          <TabsTrigger
            value="docx-export"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Download size={20} />
            {t('exportDocx')}
          </TabsTrigger>
          <TabsTrigger
            value="ai-chat"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <MessageCircle size={20} />
            {t('aiChat')}
          </TabsTrigger>
          <TabsTrigger
            value="user-search"
            className="flex items-center gap-2 py-2 px-4 rounded-md transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:text-gray-600"
          >
            <Search size={20} />
            {t('searchUsers')}
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
        <TabsContent value="github-repos" className="mt-6">
          <GithubRepoList />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationList />
        </TabsContent>
        <TabsContent value="profile-picture" className="mt-6">
          <ProfilePicture />
        </TabsContent>
        <TabsContent value="education" className="mt-6">
          <EducationList />
        </TabsContent>
        <TabsContent value="contact-info" className="mt-6">
          <ContactInfo />
        </TabsContent>
        <TabsContent value="docx-export" className="mt-6">
          <DocxExport />
        </TabsContent>
        <TabsContent value="ai-chat" className="mt-6">
          <AIChat />
        </TabsContent>
        <TabsContent value="user-search" className="mt-6">
          <UserSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}