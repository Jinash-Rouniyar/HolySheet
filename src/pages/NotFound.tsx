import React from 'react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Button 
          onClick={() => navigate('/')}
          className="rounded-full"
        >
          <Home className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound; 