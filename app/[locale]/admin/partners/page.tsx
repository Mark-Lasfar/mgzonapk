'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

export default function PartnersManagement() {
  const [partners, setPartners] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    image: '',
    description: '',
    facebook: '',
    twitter: '',
    linkedin: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    const response = await fetch('/api/partners');
    const { data } = await response.json();
    setPartners(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? '/api/partners' : '/api/partners';
    const body = editingId ? { id: editingId, ...formData } : formData;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      toast({ description: editingId ? 'Partner updated' : 'Partner added' });
      fetchPartners();
      setFormData({
        name: '',
        email: '',
        image: '',
        description: '',
        facebook: '',
        twitter: '',
        linkedin: '',
      });
      setEditingId(null);
    } else {
      toast({ description: 'Error saving partner', variant: 'destructive' });
    }
  };

  const handleEdit = (partner: any) => {
    setFormData({
      name: partner.name,
      email: partner.email,
      image: partner.image,
      description: partner.description,
      facebook: partner.socialLinks.facebook || '',
      twitter: partner.socialLinks.twitter || '',
      linkedin: partner.socialLinks.linkedin || '',
    });
    setEditingId(partner._id);
  };

  const handleDelete = async (id: string) => {
    const response = await fetch('/api/partners', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (response.ok) {
      toast({ description: 'Partner deleted' });
      fetchPartners();
    } else {
      toast({ description: 'Error deleting partner', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Manage Partners</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Input
          placeholder="Image URL"
          value={formData.image}
          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
        />
        <Textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
        <Input
          placeholder="Facebook URL"
          value={formData.facebook}
          onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
        />
        <Input
          placeholder="Twitter URL"
          value={formData.twitter}
          onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
        />
        <Input
          placeholder="LinkedIn URL"
          value={formData.linkedin}
          onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
        />
        <Button type="submit">{editingId ? 'Update' : 'Add'} Partner</Button>
      </form>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Partners List</h2>
        <ul className="space-y-4">
          {partners.map((partner: any) => (
            <li key={partner._id} className="flex justify-between items-center">
              <span>{partner.name} ({partner.email})</span>
              <div>
                <Button onClick={() => handleEdit(partner)} className="mr-2">
                  Edit
                </Button>
                <Button onClick={() => handleDelete(partner._id)} variant="destructive">
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
