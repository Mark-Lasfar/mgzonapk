'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

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
  const { toast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    image: '',
    rating: '',
    stars: 1,
    links: [] as { option: string; value: string }[],
  });
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
      loadProjects();
    }
  }, [router, toast]);

  const loadProjects = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const result: { success: boolean; data: Project[] } = await response.json();
      if (result.success) {
        setProjects(result.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load projects',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      description: '',
      image: '',
      rating: '',
      stars: 1,
      links: [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    const { id, title, description, image, rating, stars, links } = formData;
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects/${id}`
      : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ title, description, image, rating, stars, links }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: id ? 'Project updated successfully' : 'Project added successfully',
        });
        resetForm();
        await loadProjects();
      } else {
        throw new Error(result.error || 'Failed to save project');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save project',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async (id: string) => {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects/${id}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      const result: { success: boolean; data: Project } = await response.json();
      if (result.success && result.data) {
        setFormData({
          id: result.data._id,
          title: result.data.title,
          description: result.data.description,
          image: result.data.image,
          rating: result.data.rating,
          stars: result.data.stars,
          links: result.data.links,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load project',
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Project deleted successfully',
        });
        await loadProjects();
      } else {
        throw new Error(result.error || 'Failed to delete project');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const handleAddLink = () => {
    const option = prompt('Enter link in format: option|value (e.g., Code GitHub|https://github.com/...)');
    if (option) {
      const [optionText, value] = option.split('|');
      if (optionText && value) {
        setFormData((prev) => ({
          ...prev,
          links: [...prev.links, { option: optionText, value }],
        }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Add/Edit Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="hidden"
            name="id"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          />
          <Input
            type="text"
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full"
          />
          <Textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full"
            rows={4}
          />
          <Input
            type="text"
            placeholder="Image URL"
            value={formData.image}
            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            className="w-full"
          />
          <Input
            type="text"
            placeholder="Rating (e.g., Rated 4.5 stars by 3425 users)"
            value={formData.rating}
            onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Stars (1-5)"
            min="1"
            max="5"
            value={formData.stars}
            onChange={(e) => setFormData({ ...formData, stars: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="space-y-2">
            <select
              multiple
              value={formData.links.map((link) => link.value)}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions).map((opt) => ({
                  option: opt.text,
                  value: opt.value,
                }));
                setFormData({ ...formData, links: selectedOptions });
              }}
              className="w-full p-2 border rounded"
            >
              {formData.links.map((link, index) => (
                <option key={index} value={link.value}>
                  {link.option}
                </option>
              ))}
            </select>
            <Button type="button" onClick={handleAddLink}>
              Add Link
            </Button>
          </div>
          <Button type="submit">{formData.id ? 'Update Project' : 'Add Project'}</Button>
        </form>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Projects</h2>
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project._id} className="flex justify-between items-center p-2 border-b">
              <span>{project.title}</span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(project._id)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(project._id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}