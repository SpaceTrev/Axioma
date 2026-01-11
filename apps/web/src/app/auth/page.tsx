'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, Button, Input } from '@/components/ui';
import { register, login, useAuthStore } from '@/lib/store';

export default function AuthPage() {
  const router = useRouter();
  const { isLoading, error } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push('/');
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={6}
            />

            {(error || localError) && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg p-3 text-sm">
                {error || localError}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Dev Helper */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 text-center mb-3">
              Development Mode: Quick Login
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setEmail('user@example.com');
                  setPassword('password123');
                }}
              >
                Fill User
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setEmail('admin@axioma.io');
                  setPassword('admin123');
                }}
              >
                Fill Admin
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
