'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface Project {
  _id: string;
  title: string;
  description: string;
  image: string;
  rating: string;
  stars: number;
  links: { option: string; value: string }[];
}

export default function ProjectList() {
  const t = useTranslations('AccountPortfolio');
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProject, setNewProject] = useState({ title: '', description: '', rating: '', stars: 0, links: [{ option: '', value: '' }], image: null as File | null });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setProjects(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAddOrUpdateProject = async () => {
    const formData = new FormData();
    formData.append('title', newProject.title);
    formData.append('description', newProject.description);
    formData.append('rating', newProject.rating);
    formData.append('stars', newProject.stars.toString());
    formData.append('links', JSON.stringify(newProject.links));
    if (newProject.image) formData.append('image', newProject.image);

    const url = editingId ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects/${editingId}` : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? t('updateSuccess') : t('addSuccess'));
        fetchProjects();
        setNewProject({ title: '', description: '', rating: '', stars: 0, links: [{ option: '', value: '' }], image: null });
        setEditingId(null);
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleEdit = (project: Project) => {
    setEditingId(project._id);
    setNewProject({ ...project, image: null });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('deleteSuccess'));
        fetchProjects();
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
        <CardTitle>{t('projects')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder={t('projectTitle')}
            value={newProject.title}
            onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
          />
          <Textarea
            placeholder={t('projectDescription')}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />
          <Input
            placeholder={t('projectRating')}
            value={newProject.rating}
            onChange={(e) => setNewProject({ ...newProject, rating: e.target.value })}
          />
          <Input
            type="number"
            placeholder={t('projectStars')}
            value={newProject.stars}
            onChange={(e) => setNewProject({ ...newProject, stars: parseInt(e.target.value) })}
            min="0"
            max="5"
          />
          <Input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setNewProject({ ...newProject, image: e.target.files?.[0] || null })}
          />
          {newProject.links.map((link, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t('linkOption')}
                value={link.option}
                onChange={(e) => {
                  const newLinks = [...newProject.links];
                  newLinks[index].option = e.target.value;
                  setNewProject({ ...newProject, links: newLinks });
                }}
              />
              <Input
                placeholder={t('linkValue')}
                value={link.value}
                onChange={(e) => {
                  const newLinks = [...newProject.links];
                  newLinks[index].value = e.target.value;
                  setNewProject({ ...newProject, links: newLinks });
                }}
              />
              <Button
                onClick={() => setNewProject({ ...newProject, links: newProject.links.filter((_, i) => i !== index) })}
              >
                {t('removeLink')}
              </Button>
            </div>
          ))}
          <Button
            onClick={() => setNewProject({ ...newProject, links: [...newProject.links, { option: '', value: '' }] })}
          >
            {t('addLink')}
          </Button>
          <Button onClick={handleAddOrUpdateProject}>{editingId ? t('updateProject') : t('addProject')}</Button>
        </div>
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project._id}>
              <CardContent>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <p>{t('rating')}: {project.rating} ({project.stars} {t('stars')})</p>
                {project.image && <img src={project.image} alt={project.title} className="w-24 h-24" />}
                <div>
                  {project.links.map((link, index) => (
                    <p key={index}>
                      <a href={link.value} target="_blank" rel="noopener noreferrer">{link.option}</a>
                    </p>
                  ))}
                </div>
                <Button onClick={() => handleEdit(project)}>{t('edit')}</Button>
                <Button onClick={() => handleDelete(project._id)} variant="destructive">{t('delete')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}