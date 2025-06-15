import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/">
                <h1 className="text-2xl font-bold text-primary">RecruitFlow</h1>
              </Link>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm" className="flex items-center">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6 prose max-w-none">
            <h3>1. Introduction</h3>
            <p>
              Welcome to RecruitFlow ("Company", "we", "our", "us")! These Terms of Service ("Terms", "Terms of Service") govern your use of our website and services operated by the Company.
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
            </p>

            <h3>2. Use of Service</h3>
            <p>
              Our Service allows you to manage job postings, track applicants, and streamline your hiring process. You must provide accurate, complete, and updated information in order to access and use the Service.
            </p>
            <p>
              You are responsible for maintaining the confidentiality of your account, including your password, and are fully responsible for all activities that occur under your account.
            </p>

            <h3>3. Intellectual Property</h3>
            <p>
              The Service and its original content, features, and functionality are and will remain the exclusive property of the Company and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
            </p>
            <p>
              Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of the Company.
            </p>

            <h3>4. Termination</h3>
            <p>
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.
            </p>

            <h3>5. Limitation of Liability</h3>
            <p>
              In no event shall the Company, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>

            <h3>6. Changes</h3>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
            <p>
              By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please stop using the Service.
            </p>

            <h3>7. Contact Us</h3>
            <p>
              If you have any questions about these Terms, please contact us.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
            <p className="text-base text-gray-400">&copy; {new Date().getFullYear()} RecruitFlow. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/terms" className="text-gray-400 hover:text-gray-500">Terms</Link>
              <Link to="/privacy" className="text-gray-400 hover:text-gray-500">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}