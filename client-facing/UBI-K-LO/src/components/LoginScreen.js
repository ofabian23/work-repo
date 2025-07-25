import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const LoginScreen = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Login form state
  const [loginData, setLoginData] = useState({
    customerNumber: '',
    password: ''
  });
  
  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    customerNumber: '',
    businessAddress: '',
    location: '',
    password: '',
    confirmPassword: ''
  });

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    console.log('Login data:', loginData);
    // Add login logic here
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    console.log('Signup data:', signupData);
    // Add signup logic here
  };

  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-linde-50 to-linde-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-linde-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl font-bold">L</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isSignUp ? 'Join Linde Gas services' : 'Access your Linde Gas portal'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {!isSignUp ? (
            /* Login Form */
            <form className="space-y-6" onSubmit={handleLoginSubmit}>
              <div>
                <label htmlFor="customerNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Number
                </label>
                <input
                  id="customerNumber"
                  name="customerNumber"
                  type="text"
                  required
                  value={loginData.customerNumber}
                  onChange={(e) => setLoginData({...loginData, customerNumber: e.target.value})}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your customer number"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => togglePasswordVisibility('password')}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-linde-600 hover:bg-linde-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linde-500 transition duration-150 ease-in-out"
                >
                  Sign In
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-linde-600 hover:text-linde-500 text-sm font-medium"
                >
                  Don't have an account? Sign up
                </button>
              </div>
            </form>
          ) : (
            /* Signup Form */
            <form className="space-y-6" onSubmit={handleSignupSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={signupData.email}
                  onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="signupCustomerNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Number
                </label>
                <input
                  id="signupCustomerNumber"
                  name="signupCustomerNumber"
                  type="text"
                  required
                  value={signupData.customerNumber}
                  onChange={(e) => setSignupData({...signupData, customerNumber: e.target.value})}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your customer number"
                />
              </div>

              <div>
                <label htmlFor="businessAddress" className="block text-sm font-medium text-gray-700 mb-2">
                  Business Address
                </label>
                <input
                  id="businessAddress"
                  name="businessAddress"
                  type="text"
                  required
                  value={signupData.businessAddress}
                  onChange={(e) => setSignupData({...signupData, businessAddress: e.target.value})}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your business address"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  required
                  value={signupData.location}
                  onChange={(e) => setSignupData({...signupData, location: e.target.value})}
                  className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your location"
                />
              </div>

              <div>
                <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signupPassword"
                    name="signupPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={signupData.password}
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                    className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => togglePasswordVisibility('password')}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
                    className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-linde-500 focus:border-linde-500 focus:z-10 sm:text-sm"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => togglePasswordVisibility('confirm')}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-linde-600 hover:bg-linde-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-linde-500 transition duration-150 ease-in-out"
                >
                  Create Account
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-linde-600 hover:text-linde-500 text-sm font-medium"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>© 2024 Linde Gas. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen; 