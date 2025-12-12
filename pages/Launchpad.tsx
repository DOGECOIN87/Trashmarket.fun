import React, { useState } from 'react';
import { generateNFTImage } from '../services/geminiService';
import { LaunchpadStatus } from '../types';
import { Sparkles, Image as ImageIcon, Download, RefreshCw, Wand2 } from 'lucide-react';

const Launchpad: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<LaunchpadStatus>(LaunchpadStatus.IDLE);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setStatus(LaunchpadStatus.GENERATING);
    setGeneratedImage(null);
    
    const result = await generateNFTImage(prompt);
    
    if (result) {
        setGeneratedImage(result);
        setStatus(LaunchpadStatus.SUCCESS);
    } else {
        setStatus(LaunchpadStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] pt-12 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-black border border-magic-green/30 text-magic-green text-xs font-bold uppercase tracking-widest mb-4">
                <Sparkles className="w-3 h-3" /> TRASH_AI_GENERATOR
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter">TRASH_LAUNCHPAD</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto font-mono">
                Generate pure garbage (art) for your next collection. 
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="bg-[#1c1c24] p-6 border border-white/10 h-fit relative group">
                {/* Decor corners */}
                <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-white/50"></div>
                <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-white/50"></div>

                <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Prompt_Input</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g. A pixelated trash can burning in space..."
                    className="w-full h-40 bg-black border border-white/20 p-4 text-white placeholder-gray-700 focus:outline-none focus:border-magic-green resize-none mb-6 text-sm font-mono"
                />
                
                <button
                    onClick={handleGenerate}
                    disabled={status === LaunchpadStatus.GENERATING || !prompt.trim()}
                    className={`w-full py-4 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${
                        status === LaunchpadStatus.GENERATING 
                        ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-magic-green text-black border-magic-green hover:bg-black hover:text-magic-green'
                    }`}
                >
                    {status === LaunchpadStatus.GENERATING ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> PROCESSING...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-4 h-4" /> GENERATE_ASSET
                        </>
                    )}
                </button>
            </div>

            {/* Preview Section */}
            <div className="bg-[#1c1c24] p-6 border border-white/10 flex flex-col items-center justify-center min-h-[400px] relative">
                 <div className="absolute top-2 right-2 flex gap-1">
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                    <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                 </div>

                {status === LaunchpadStatus.SUCCESS && generatedImage ? (
                    <div className="w-full animate-fade-in">
                        <div className="aspect-square w-full overflow-hidden mb-4 border border-magic-green relative group bg-black">
                            <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <a 
                                    href={generatedImage} 
                                    download="trash-nft.png"
                                    className="bg-white text-black px-6 py-2 font-bold uppercase text-xs flex items-center gap-2 hover:bg-magic-green hover:text-black transition-colors"
                                >
                                    <Download className="w-4 h-4" /> Save_Asset
                                </a>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-xs font-mono uppercase">
                            <span className="text-magic-green">Status: READY_TO_MINT</span>
                            <span className="text-gray-500">100% Unique</span>
                        </div>
                    </div>
                ) : status === LaunchpadStatus.GENERATING ? (
                    <div className="text-center">
                        <div className="w-16 h-16 border-2 border-magic-green border-t-transparent animate-spin mx-auto mb-4 rounded-full"></div>
                        <p className="text-magic-green font-mono text-xs animate-pulse">HALLUCINATING...</p>
                    </div>
                ) : status === LaunchpadStatus.ERROR ? (
                    <div className="text-center text-magic-red font-mono">
                        <p className="mb-2 uppercase font-bold">Generation Failed</p>
                        <p className="text-xs opacity-70">Try a different prompt.</p>
                    </div>
                ) : (
                    <div className="text-center text-gray-700">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="font-mono text-xs uppercase">Output_Preview</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Launchpad;
