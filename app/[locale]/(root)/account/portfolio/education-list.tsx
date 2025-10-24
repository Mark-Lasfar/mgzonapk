'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface Education {
  _id: string;
  degree: string;
  institution: string;
  startYear: number;
  endYear: number;
  description: string;
}

export default function EducationList() {
  const t = useTranslations('AccountPortfolio');
  const [educations, setEducations] = useState<Education[]>([]);
  const [newEducation, setNewEducation] = useState({
    degree: '',
    institution: '',
    startYear: 0,
    endYear: 0,
    description: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchEducations = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/educations`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) setEducations(data.data);
      else toast.error(t('fetchError'));
    } catch (error) {
      toast.error(t('fetchError'));
    }
  };

  useEffect(() => {
    fetchEducations();
  }, []);

  const handleAddOrUpdateEducation = async () => {
    const url = editingId
      ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/educations/${editingId}`
      : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/educations`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEducation),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(editingId ? t('updateSuccess') : t('addSuccess'));
        fetchEducations();
        setNewEducation({ degree: '', institution: '', startYear: 0, endYear: 0, description: '' });
        setEditingId(null);
      } else {
        toast.error(data.error || t('operationFailed'));
      }
    } catch (error) {
      toast.error(t('operationFailed'));
    }
  };

  const handleEdit = (education: Education) => {
    setEditingId(education._id);
    setNewEducation(education);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/educations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('deleteSuccess'));
        fetchEducations();
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
        <CardTitle>{t('education')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder={t('degree')}
            value={newEducation.degree}
            onChange={(e) => setNewEducation({ ...newEducation, degree: e.target.value })}
          />
          <Input
            placeholder={t('institution')}
            value={newEducation.institution}
            onChange={(e) => setNewEducation({ ...newEducation, institution: e.target.value })}
          />
          <Input
            type="number"
            placeholder={t('startYear')}
            value={newEducation.startYear || ''}
            onChange={(e) => setNewEducation({ ...newEducation, startYear: parseInt(e.target.value) })}
          />
          <Input
            type="number"
            placeholder={t('endYear')}
            value={newEducation.endYear || ''}
            onChange={(e) => setNewEducation({ ...newEducation, endYear: parseInt(e.target.value) })}
          />
          <Textarea
            placeholder={t('educationDescription')}
            value={newEducation.description}
            onChange={(e) => setNewEducation({ ...newEducation, description: e.target.value })}
          />
          <Button onClick={handleAddOrUpdateEducation}>
            {editingId ? t('updateEducation') : t('addEducation')}
          </Button>
        </div>
        <div className="grid gap-4">
          {educations.map((education) => (
            <Card key={education._id}>
              <CardContent>
                <h3>{education.degree}</h3>
                <p>{t('institution')}: {education.institution}</p>
                <p>
                  {t('period')}: {education.startYear} - {education.endYear}
                </p>
                <p>{t('description')}: {education.description}</p>
                <Button onClick={() => handleEdit(education)}>{t('edit')}</Button>
                <Button onClick={() => handleDelete(education._id)} variant="destructive">
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