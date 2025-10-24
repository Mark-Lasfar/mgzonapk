'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface Skill {
  _id: string;
  name: string;
  icon: string;
  percentage: number;
}

export default function SkillList() {
  const { toast } = useToast();
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    icon: '',
    percentage: 0,
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
      loadSkills();
    }
  }, [router, toast]);

  const loadSkills = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to fetch skills');
      }
      const result: { success: boolean; data: Skill[] } = await response.json();
      if (result.success) {
        setSkills(result.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load skills',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      icon: '',
      percentage: 0,
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

    const { id, name, icon, percentage } = formData;
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills/${id}`
      : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ name, icon, percentage }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save skill');
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: id ? 'Skill updated successfully' : 'Skill added successfully',
        });
        resetForm();
        await loadSkills();
      } else {
        throw new Error(result.error || 'Failed to save skill');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save skill',
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch skill');
      }
      const result: { success: boolean; data: Skill[] } = await response.json();
      if (result.success) {
        const skill = result.data.find((s) => s._id === id);
        if (skill) {
          setFormData({
            id: skill._id,
            name: skill.name,
            icon: skill.icon,
            percentage: skill.percentage,
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load skill',
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete skill');
      }
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Skill deleted successfully',
        });
        await loadSkills();
      } else {
        throw new Error(result.error || 'Failed to delete skill');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete skill',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Add/Edit Skill</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="hidden"
            name="id"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          />
          <Input
            type="text"
            placeholder="Skill Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full"
          />
          <Input
            type="text"
            placeholder="Icon URL"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full"
          />
          <Input
            type="number"
            placeholder="Percentage (0-100)"
            min="0"
            max="100"
            value={formData.percentage}
            onChange={(e) => setFormData({ ...formData, percentage: parseInt(e.target.value) })}
            className="w-full"
          />
          <Button type="submit">{formData.id ? 'Update Skill' : 'Add Skill'}</Button>
        </form>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Skills</h2>
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li key={skill._id} className="flex justify-between items-center p-2 border-b">
              <span>{skill.name} ({skill.percentage}%)</span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(skill._id)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(skill._id)}
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