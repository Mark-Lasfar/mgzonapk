'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface Skill {
  _id: string;
  name: string;
  icon: string;
  percentage: number;
}

export default function SkillList() {
  const t = useTranslations('AccountPortfolio');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState({ name: '', icon: '', percentage: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchSkills = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setSkills(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleAddOrUpdateSkill = async () => {
    const url = editingId ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills/${editingId}` : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSkill),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? t('updateSuccess') : t('addSuccess'));
        fetchSkills();
        setNewSkill({ name: '', icon: '', percentage: 0 });
        setEditingId(null);
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleEdit = (skill: Skill) => {
    setEditingId(skill._id);
    setNewSkill(skill);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/skills/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('deleteSuccess'));
        fetchSkills();
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
        <CardTitle>{t('skills')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder={t('skillName')}
            value={newSkill.name}
            onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
          />
          <Input
            placeholder={t('skillIcon')}
            value={newSkill.icon}
            onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })}
          />
          <Input
            type="number"
            placeholder={t('skillPercentage')}
            value={newSkill.percentage}
            onChange={(e) => setNewSkill({ ...newSkill, percentage: parseInt(e.target.value) })}
            min="0"
            max="100"
          />
          <Button onClick={handleAddOrUpdateSkill}>{editingId ? t('updateSkill') : t('addSkill')}</Button>
        </div>
        <div className="grid gap-4">
          {skills.map((skill) => (
            <Card key={skill._id}>
              <CardContent>
                <h3>{skill.name}</h3>
                <p>{t('percentage')}: {skill.percentage}%</p>
                <p>{t('icon')}: {skill.icon}</p>
                <Button onClick={() => handleEdit(skill)}>{t('edit')}</Button>
                <Button onClick={() => handleDelete(skill._id)} variant="destructive">{t('delete')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}