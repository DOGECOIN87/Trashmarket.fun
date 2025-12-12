import React, { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useNetwork } from '../contexts/NetworkContext';
import { submitCollection, getSubmissionCount } from '../services/submissionService';
import { CollectionSubmission, SubmissionStatus } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Wallet,
  ExternalLink,
  Loader2,
  Trash2
} from 'lucide-react';

// Step types
interface FormData {
  // Step 1: Collection Info
  name: string;
  symbol: string;
  description: string;
  supply: number;
  mintPrice: number;
  mintDate: string;
  
  // Step 2: Visual Assets
  logoFile: File | null;
  bannerFile: File | null;
  sampleFiles: File[];
  
  // Step 3: Contract & Links
  contractAddress: string;
  royaltyPercentage: number;
  website: string;
  twitter: string;
  discord: string;
  telegram: string;
  
  // Step 4: Project Info
  teamInfo: string;
  roadmap: string;
  utility: string;
  contactEmail: string;
}

interface StepProps {
  data: FormData;
  updateData: (updates: Partial<FormData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const INITIAL_FORM_DATA: FormData = {
  name: '',
  symbol: '',
  description: '',
  supply: 1000,
  mintPrice: 0.1,
  mintDate: '',
  logoFile: null,
  bannerFile: null,
  sampleFiles: [],
  contractAddress: '',
  royaltyPercentage: 5,
  website: '',
  twitter: '',
  discord: '',
  telegram: '',
  teamInfo: '',
  roadmap: '',
  utility: '',
  contactEmail: '',
};

const Submit: React.FC = () => {
  const { connected, address, connect } = useWallet();
  const { currency } = useNetwork();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submissionCount, setSubmissionCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const MAX_SUBMISSIONS_PER_WALLET = 3;

  // Load submission count when wallet connects
  const loadSubmissionCount = useCallback(async () => {
    if (address) {
      setIsLoading(true);
      try {
        const count = await getSubmissionCount(address);
        setSubmissionCount(count);
      } catch (error) {
        console.error('Error loading submission count:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [address]);

  React.useEffect(() => {
    if (connected && address) {
      loadSubmissionCount();
    }
  }, [connected, address, loadSubmissionCount]);

  const updateData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleWalletConnect = async () => {
    if (!connected) {
      // We'll add wallet selection modal here
      // For now, show a message
      alert('Wallet connection modal will be implemented in the Navbar update.');
    }
  };

  const handleSubmit = async () => {
    if (!connected || !address) {
      setSubmitError('Please connect your wallet first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submissionId = await submitCollection(
        {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          supply: formData.supply,
          mintPrice: formData.mintPrice,
          mintDate: formData.mintDate,
          contractAddress: formData.contractAddress,
          creatorWallet: address,
          submittedBy: address,
          royaltyPercentage: formData.royaltyPercentage,
          website: formData.website || undefined,
          twitter: formData.twitter || undefined,
          discord: formData.discord || undefined,
          telegram: formData.telegram || undefined,
          teamInfo: formData.teamInfo,
          roadmap: formData.roadmap,
          utility: formData.utility,
          contactEmail: formData.contactEmail,
          logoUrl: '',
          bannerUrl: '',
          sampleImages: [],
        },
        formData.logoFile || undefined,
        formData.bannerFile || undefined,
        formData.sampleFiles.length > 0 ? formData.sampleFiles : undefined
      );

      setSubmitSuccess(`Collection submitted successfully! ID: ${submissionId}`);
      
      // Reset form
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
      
      // Refresh submission count
      await loadSubmissionCount();
      
    } catch (error: any) {
      console.error('Submission error:', error);
      setSubmitError(error.message || 'Failed to submit collection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user has reached submission limit
  const hasReachedLimit = submissionCount !== null && submissionCount >= MAX_SUBMISSIONS_PER_WALLET;

  return (
    <div className="min-h-screen bg-black pt-12 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trash2 className="w-6 h-6 text-magic-green" />
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">
              SUBMIT_COLLECTION
            </h1>
          </div>
          <p className="text-gray-400 text-lg font-mono">
            Submit your NFT collection for listing on Gorbagana marketplace
          </p>
        </div>

        {/* Wallet Connection Required */}
        {!connected ? (
          <div className="bg-[#1c1c24] border border-white/20 p-8 text-center">
            <Wallet className="w-12 h-12 text-magic-green mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2 uppercase">Wallet Required</h2>
            <p className="text-gray-400 mb-6 font-mono">
              Please connect your wallet to submit a collection.
            </p>
            <button
              onClick={handleWalletConnect}
              className="bg-magic-green text-black px-8 py-3 font-bold uppercase tracking-widest hover:bg-black hover:text-magic-green border border-magic-green transition-all"
            >
              Connect Wallet
            </button>
          </div>
        ) : hasReachedLimit ? (
          <div className="bg-[#1c1c24] border border-magic-red p-8 text-center">
            <AlertCircle className="w-12 h-12 text-magic-red mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-magic-red mb-2 uppercase">Submission Limit Reached</h2>
            <p className="text-gray-400 mb-2 font-mono">
              You have reached the maximum of {MAX_SUBMISSIONS_PER_WALLET} submissions per wallet.
            </p>
            <p className="text-gray-500 text-sm font-mono">
              Contact the team for assistance with additional submissions.
            </p>
          </div>
        ) : (
          <>
            {/* Progress Steps */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`flex items-center ${
                      step < 4 ? 'flex-1' : ''
                    } ${step < 4 ? 'border-r border-white/20' : ''}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
                        step <= currentStep
                          ? 'bg-magic-green text-black border-magic-green'
                          : 'bg-transparent text-gray-600 border-gray-600'
                      }`}
                    >
                      {step < currentStep ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step
                      )}
                    </div>
                    <div className="ml-3 hidden sm:block">
                      <div className={`text-sm font-bold uppercase ${
                        step <= currentStep ? 'text-white' : 'text-gray-600'
                      }`}>
                        {step === 1 && 'Collection Info'}
                        {step === 2 && 'Assets'}
                        {step === 3 && 'Contract'}
                        {step === 4 && 'Preview'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full bg-gray-800 h-1">
                <div 
                  className="bg-magic-green h-1 transition-all duration-500"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />
              </div>
            </div>

            {/* Error/Success Messages */}
            {submitError && (
              <div className="mb-6 p-4 bg-magic-red/10 border border-magic-red/30 text-magic-red font-mono">
                [ERROR] {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="mb-6 p-4 bg-magic-green/10 border border-magic-green/30 text-magic-green font-mono">
                [SUCCESS] {submitSuccess}
              </div>
            )}

            {/* Form Steps */}
            <div className="bg-[#1c1c24] border border-white/20">
              {currentStep === 1 && (
                <Step1 
                  data={formData} 
                  updateData={updateData} 
                  onNext={() => setCurrentStep(2)}
                  onBack={() => setCurrentStep(1)}
                  onSubmit={() => {}}
                  isSubmitting={isSubmitting}
                />
              )}
              {currentStep === 2 && (
                <Step2 
                  data={formData} 
                  updateData={updateData} 
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                  onSubmit={() => {}}
                  isSubmitting={isSubmitting}
                />
              )}
              {currentStep === 3 && (
                <Step3 
                  data={formData} 
                  updateData={updateData} 
                  onNext={() => setCurrentStep(4)}
                  onBack={() => setCurrentStep(2)}
                  onSubmit={() => {}}
                  isSubmitting={isSubmitting}
                />
              )}
              {currentStep === 4 && (
                <Step4 
                  data={formData} 
                  updateData={updateData} 
                  onNext={() => {}}
                  onBack={() => setCurrentStep(3)}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>
          </>
        )}

        {/* Submission Count Display */}
        {connected && submissionCount !== null && !hasReachedLimit && (
          <div className="mt-8 text-center">
            <p className="text-gray-500 font-mono text-sm">
              Submissions used: {submissionCount}/{MAX_SUBMISSIONS_PER_WALLET}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Step 1: Collection Information
const Step1: React.FC<StepProps> = ({ data, updateData, onNext, isSubmitting }) => {
  const isValid = data.name && data.symbol && data.description && data.supply > 0 && data.mintPrice > 0;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6 uppercase">Collection_Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Collection Name *
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => updateData({ name: e.target.value })}
            placeholder="e.g., Cool NFT Collection"
            className="w-full bg-black border border-white/20 p-3 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green font-mono"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Symbol *
          </label>
          <input
            type="text"
            value={data.symbol}
            onChange={(e) => updateData({ symbol: e.target.value.toUpperCase() })}
            placeholder="e.g., COOL"
            className="w-full bg-black border border-white/20 p-3 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green font-mono uppercase"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Description *
          </label>
          <textarea
            value={data.description}
            onChange={(e) => updateData({ description: e.target.value })}
            placeholder="Describe your collection..."
            maxLength={500}
            rows={4}
            className="w-full bg-black border border-white/20 p-3 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green font-mono resize-none"
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {data.description.length}/500
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Total Supply *
          </label>
          <input
            type="number"
            value={data.supply}
            onChange={(e) => updateData({ supply: parseInt(e.target.value) || 0 })}
            placeholder="1000"
            min="1"
            className="w-full bg-black border border-white/20 p-3 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green font-mono"
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Mint Price (in {data.mintPrice ? 'G' : 'GOR'}) *
          </label>
          <input
            type="number"
            value={data.mintPrice}
            onChange={(e) => updateData({ mintPrice: parseFloat(e.target.value) || 0 })}
            placeholder="0.1"
            min="0"
            step="0.01"
            className="w-full bg-black border border-white/20 p-3 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green font-mono"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Mint Date & Time *
          </label>
          <input
            type="datetime-local"
            value={data.mintDate}
            onChange={(e) => updateData({ mintDate: e.target.value })}
            className="w-full bg-black border border-white/20 p-3 text-white focus:outline-none focus:border-magic-green font-mono"
          />
        </div>
      </div>
      
      <div className="flex justify-end mt-8">
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`px-8 py-3 font-bold uppercase tracking-widest flex items-center gap-2 border transition-all ${
            isValid
              ? 'bg-magic-green text-black border-magic-green hover:bg-black hover:text-magic-green'
              : 'bg-gray-800 text-gray-600 border-gray-800 cursor-not-allowed'
          }`}
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Step 2: Visual Assets
const Step2: React.FC<StepProps> = ({ data, updateData, onNext, onBack }) => {
  const handleFileChange = (type: 'logo' | 'banner' | 'sample', files: FileList | null) => {
    if (!files) return;
    
    if (type === 'logo') {
      updateData({ logoFile: files[0] });
    } else if (type === 'banner') {
      updateData({ bannerFile: files[0] });
    } else if (type === 'sample') {
      const sampleFiles = Array.from(files).slice(0, 5); // Max 5 samples
      updateData({ sampleFiles });
    }
  };

  const removeFile = (type: 'logo' | 'banner' | 'sample', index?: number) => {
    if (type === 'logo') {
      updateData({ logoFile: null });
    } else if (type === 'banner') {
      updateData({ bannerFile: null });
    } else if (type === 'sample' && index !== undefined) {
      const newSamples = data.sampleFiles.filter((_, i) => i !== index);
      updateData({ sampleFiles: newSamples });
    }
  };

  const isValid = data.logoFile && data.bannerFile;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6 uppercase">Visual_Assets</h2>
      
      <div className="space-y-8">
        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Collection Logo * (400x400px minimum)
          </label>
          <div className="border-2 border-dashed border-white/20 p-6">
            {data.logoFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img 
                    src={URL.createObjectURL(data.logoFile)} 
                    alt="Logo" 
                    className="w-16 h-16 object-cover border border-white/20"
                  />
                  <div>
                    <p className="text-white font-mono">{data.logoFile.name}</p>
                    <p className="text-gray-500 text-sm">{(data.logoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile('logo')}
                  className="text-magic-red hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-600" />
                <span className="text-gray-600 font-mono text-sm">Click to upload logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('logo', e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Banner Upload */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Collection Banner * (1600x400px recommended)
          </label>
          <div className="border-2 border-dashed border-white/20 p-6">
            {data.bannerFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img 
                    src={URL.createObjectURL(data.bannerFile)} 
                    alt="Banner" 
                    className="w-24 h-16 object-cover border border-white/20"
                  />
                  <div>
                    <p className="text-white font-mono">{data.bannerFile.name}</p>
                    <p className="text-gray-500 text-sm">{(data.bannerFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile('banner')}
                  className="text-magic-red hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-600" />
                <span className="text-gray-600 font-mono text-sm">Click to upload banner</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('banner', e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Sample Images */}
        <div>
          <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
            Sample NFTs (up to 5)
          </label>
          <div className="border-2 border-dashed border-white/20 p-6">
            {data.sampleFiles.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.sampleFiles.map((file, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={`Sample ${index + 1}`}
                      className="w-full h-24 object-cover border border-white/20"
                    />
                    <button
                      onClick={() => removeFile('sample', index)}
                      className="absolute -top-2 -right-2 bg-magic-red text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {data.sampleFiles.length < 5 && (
                  <label className="cursor-pointer border border-white/20 border-dashed flex flex-col items-center justify-center h-24 hover:border-magic-green">
                    <Upload className="w-4 h-4 text-gray-600" />
                    <span className="text-xs text-gray-600 mt-1">Add more</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileChange('sample', e.target.files)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-600" />
                <span className="text-gray-600 font-mono text-sm">Click to upload sample NFTs</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange('sample', e.target.files)}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-8 py-3 font-bold uppercase tracking-widest flex items-center gap-2 border border-white/20 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`px-8 py-3 font-bold uppercase tracking-widest flex items-center gap-2 border transition-all ${
            isValid
              ? 'bg-magic-green text-black border-magic-green hover:bg-black hover:text-magic-green'
              : 'bg-gray-800 text-gray-600 border-gray-800 cursor-not-allowed'
          }`}
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Continue with Step3 and Step4 components...

export default Submit;
