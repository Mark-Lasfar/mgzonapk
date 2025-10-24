'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  username: string;
  email: string;
  profile: { nickname?: string; avatar?: string; portfolioName?: string };
  role: 'User' | 'Admin';
}

export default function UserList() {
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    id: '',
    username: '',
    email: '',
    password: '',
    role: 'User' as 'User' | 'Admin',
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
      loadUsers();
    }
  }, [router, toast]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/users`, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const result: { success: boolean; data: User[] } = await response.json();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load users',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      username: '',
      email: '',
      password: '',
      role: 'User',
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

    const { id, username, email, password, role } = formData;
    const method = id ? 'PUT' : 'POST';
    const url = id
      ? `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/users/${id}`
      : `${process.env.NEXT_PUBLIC_BACK_API_URL}/api/users`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(id ? { role } : { username, email, password, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${id ? 'update' : 'create'} user`);
      }

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: id ? 'User updated successfully' : 'User created successfully',
        });
        resetForm();
        await loadUsers();
      } else {
        throw new Error(result.error || `Failed to ${id ? 'update' : 'create'} user`);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${id ? 'update' : 'create'} user`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (user: User) => {
    setFormData({ id: user._id, username: user.username, email: user.email, password: '', role: user.role });
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Success',
          description: 'User deleted successfully',
        });
        await loadUsers();
      } else {
        throw new Error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Add/Edit User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="hidden"
            name="id"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          />
          <Input
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full"
            disabled={!!formData.id}
          />
          <Input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full"
            disabled={!!formData.id}
          />
          {!formData.id && (
            <Input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full"
            />
          )}
          <Input
            type="text"
            placeholder="Role (User or Admin)"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'User' | 'Admin' })}
            className="w-full"
          />
          <Button type="submit">{formData.id ? 'Update User Role' : 'Add User'}</Button>
        </form>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Users</h2>
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user._id} className="flex justify-between items-center p-2 border-b">
              <span>{user.username} ({user.email}) - {user.role}</span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(user)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(user._id)}
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