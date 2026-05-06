/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Sparkles, 
  Target, 
  Users, 
  Layout, 
  Image as ImageIcon, 
  Copy, 
  Download,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Bookmark,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  ChevronLeft,
  Plus,
  Bell,
  X,
  ExternalLink,
  Upload,
  ImagePlus,
  SlidersHorizontal,
  Sun,
  Contrast,
  Maximize2,
  Minimize2,
  Wand2,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  LogIn,
  LogOut,
  User as UserIcon,
  FileText,
  FileCode,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Firebase imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

type Platform = "LinkedIn" | "Instagram" | "Twitter/X" | "Facebook" | "TikTok";

interface Persona {
  id: string;
  name: string;
  age: string;
  location: string;
  occupation: string;
  interests: string;
  painPoints: string;
  onlineBehavior: string;
}

interface BrandVoice {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
}

interface GeneratedPost {
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  testGroupId?: string;
  variant?: string;
}

interface SavedPost extends GeneratedPost {
  id: string;
  platform: Platform;
  personaName: string;
  scheduledAt?: string;
  createdAt: string;
  status: "scheduled" | "published" | "failed";
  adjustments?: {
    brightness: number;
    contrast: number;
    filter: string;
    zoom: number;
  };
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "error";
}

interface PostTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  promptGuidance: string;
}

const POST_TEMPLATES: PostTemplate[] = [
  { 
    id: "launch", 
    name: "Product Launch", 
    description: "Build hype for a new release",
    emoji: "🚀",
    promptGuidance: "Focus on innovation, excitement, and a single powerful call-to-action for pre-orders or the launch event."
  },
  { 
    id: "event", 
    name: "Event Promotion", 
    description: "Get people to register",
    emoji: "📅",
    promptGuidance: "Highlight key speakers or activities, create urgency for registration, and clearly state when and where."
  },
  { 
    id: "tip", 
    name: "Educational Tip", 
    description: "Provide value as an expert",
    emoji: "💡",
    promptGuidance: "Break down a complex topic into one actionable tip that solves a specific audience pain point."
  },
  { 
    id: "qa", 
    name: "Q&A / Engagement", 
    description: "Start a conversation",
    emoji: "❓",
    promptGuidance: "Ask a provocative or helpful question to encourage comments and sharing, sharing a brief perspective first."
  },
  { 
    id: "bts", 
    name: "Behind the Scenes", 
    description: "Show the human side",
    emoji: "🏗️",
    promptGuidance: "Focus on process, raw moments, or the 'why' behind the work to build deep trust and connection."
  },
  { 
    id: "success", 
    name: "Customer Success", 
    description: "Share a win or testimonial",
    emoji: "⭐",
    promptGuidance: "Narrate a transformation story from a customer's perspective, emphasizing the positive results achieved."
  },
  { 
    id: "feature", 
    name: "Feature Spotlight", 
    description: "Highlight a specific tool or benefit",
    emoji: "🎯",
    promptGuidance: "Deep dive into one specific feature or service aspect. Explain the problem it solves and why it matters now."
  },
  { 
    id: "sale", 
    name: "Flash Sale", 
    description: "Drive quick conversions",
    emoji: "🏷️",
    promptGuidance: "Focus on scarcity, high value, and immediate action. Make the discount or offer the hero of the post."
  },
  { 
    id: "expert", 
    name: "Expert Opinion", 
    description: "Share a contrarian or deep insight",
    emoji: "🧠",
    promptGuidance: "Take a stand on an industry trend. Provide a unique perspective that challenges the status quo or offers deep value."
  },
];

const PREDEFINED_VOICES: BrandVoice[] = [
  { id: "prof", name: "Professional & Authoritative", description: "Expert, confident, and formal tone. Uses industry terminology and structured arguments." },
  { id: "friendly", name: "Friendly & Casual", description: "Warm, approachable, and conversational. Uses everyday language and relatable anecdotes." },
  { id: "witty", name: "Witty & Playful", description: "Humorous, clever, and energetic. Uses puns, lighthearted sarcasm, and creative metaphors." },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<Platform>("LinkedIn");
  
  // Personas State
  const [personas, setPersonas] = useState<Persona[]>([
    {
      id: "1",
      name: "Tech Entrepreneur",
      age: "25-40",
      location: "San Francisco / Remote",
      occupation: "Startup Founder",
      interests: "AI, venture capital, productivity hacks",
      painPoints: "Scaling quickly, finding talent, work-life balance",
      onlineBehavior: "Active on LinkedIn and Twitter, reads newsletters",
    }
  ]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("1");
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({});

  // Brand Voice State
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("prof");
  const [customVoice, setCustomVoice] = useState("");
  const [isCustomVoice, setIsCustomVoice] = useState(false);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  // Image Adjustment State
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    filter: "none",
    zoom: 100
  });
  const [isEditingImage, setIsEditingImage] = useState(false);

  // Refinement State
  const [isRefining, setIsRefining] = useState(false);
  const [refinementSuggestions, setRefinementSuggestions] = useState<string[]>([]);
  const [showRefinements, setShowRefinements] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [post, setPost] = useState<GeneratedPost | null>(null);
  const [variations, setVariations] = useState<GeneratedPost[]>([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  // Saved Posts State
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [activeTab, setActiveTab] = useState<"create" | "library" | "calendar" | "chat">("create");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const platforms: Platform[] = ["LinkedIn", "Instagram", "Twitter/X", "Facebook", "TikTok"];

  // Auth Effect
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthLoading(false);
    });
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!user) {
      // Clear states if logged out if you want, or just let the UI handle it
      return;
    }

    // Subscribe to Personas
    const personaPath = `users/${user.uid}/personas`;
    const unsubPersonas = onSnapshot(collection(db, personaPath), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as Persona);
      if (list.length > 0) setPersonas(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, personaPath));

    // Subscribe to Voices
    const voicePath = `users/${user.uid}/voices`;
    const unsubVoices = onSnapshot(collection(db, voicePath), (snapshot) => {
      // Do nothing for now or merge with predefined?
    }, (error) => handleFirestoreError(error, OperationType.GET, voicePath));

    // Subscribe to Posts
    const postPath = `users/${user.uid}/posts`;
    const unsubPosts = onSnapshot(collection(db, postPath), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data() as SavedPost);
      setSavedPosts(list);
    }, (error) => handleFirestoreError(error, OperationType.GET, postPath));

    // Subscribe to Config
    const configPath = `users/${user.uid}/config/main`;
    const unsubConfig = onSnapshot(doc(db, configPath), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.brandLogo) setBrandLogo(data.brandLogo);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, configPath));

    return () => {
      unsubPersonas();
      unsubVoices();
      unsubPosts();
      unsubConfig();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Check for scheduled posts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const duePosts = savedPosts.filter(p => 
        p.status === "scheduled" && 
        p.scheduledAt && 
        new Date(p.scheduledAt) <= now
      );

      if (duePosts.length > 0) {
        duePosts.forEach(post => {
          // Trigger "Publishing"
          triggerPublish(post);
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [savedPosts]);

  const triggerPublish = async (post: SavedPost) => {
    if (!user) return;
    const notification: AppNotification = {
      id: Date.now().toString() + Math.random(),
      title: "Post Published!",
      message: `Your scheduled post for ${post.platform} has been successfully published.`,
      type: "success"
    };
    
    setNotifications(prev => [notification, ...prev]);
    
    const postPath = `users/${user.uid}/posts/${post.id}`;
    try {
      await setDoc(doc(db, postPath), { status: "published" }, { merge: true });
    } catch (error) {
      console.error("Failed to update post status:", error);
    }

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  useEffect(() => {
    localStorage.setItem("storypost_library", JSON.stringify(savedPosts));
  }, [savedPosts]);

  const handleSavePost = async (specificPost?: GeneratedPost) => {
    const targetPost = specificPost || post;
    if (!targetPost || !user) return;
    const id = Date.now().toString() + (specificPost ? `-${specificPost.variant}` : "");
    const newSavedPost: SavedPost = {
      ...targetPost,
      id,
      platform,
      personaName: selectedPersona?.name || "Unknown",
      scheduledAt: scheduleDate || undefined,
      createdAt: new Date().toISOString(),
      status: scheduleDate ? "scheduled" : "published",
      adjustments: { ...adjustments }
    };
    
    const postPath = `users/${user.uid}/posts/${id}`;
    try {
      await setDoc(doc(db, postPath), newSavedPost);
      if (!specificPost) {
        setScheduleDate("");
        setAdjustments({ brightness: 100, contrast: 100, filter: "none", zoom: 100 });
        setIsEditingImage(false);
        setActiveTab("library");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, postPath);
    }
  };

  const handleSaveAllVariations = async () => {
    if (variations.length === 0) return;
    for (const v of variations) {
      await handleSavePost(v);
    }
    setScheduleDate("");
    setAdjustments({ brightness: 100, contrast: 100, filter: "none", zoom: 100 });
    setIsEditingImage(false);
    setActiveTab("library");
  };

  const handleDeletePost = async (id: string) => {
    if (!user) return;
    const postPath = `users/${user.uid}/posts/${id}`;
    try {
      await deleteDoc(doc(db, postPath));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, postPath);
    }
  };

  const handleUpdatePost = async (id: string, newText: string) => {
    if (!user) return;
    const postPath = `users/${user.uid}/posts/${id}`;
    try {
      await setDoc(doc(db, postPath), { text: newText }, { merge: true });
      setEditingPostId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, postPath);
    }
  };

  const handleRefinePost = async (mode: "refine" | "expand" | "shorten") => {
    if (!post?.text) return;
    
    setIsRefining(true);
    setShowRefinements(true);
    setRefinementSuggestions([]);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I have a social media post and I want to ${mode} it. 
        Mode: ${mode}
        
        ${mode === "refine" ? "Improve the overall quality, hook, and flow while keeping the length similar." : ""}
        ${mode === "expand" ? "Add more detail, depth, and storytelling elements to make it longer and more impactful." : ""}
        ${mode === "shorten" ? "Make it punchy, concise, and direct while maintaining the core message and CTA." : ""}
        
        Original Post:
        ${post.text}
        
        Generate 3 distinct variations of the post content that maintain the original tone but apply the requested ${mode} action.
        
        Format your response as a JSON array of strings:
        ["variation 1", "variation 2", "variation 3"]`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "[]";
      const suggestions = JSON.parse(text);
      setRefinementSuggestions(suggestions);
    } catch (error) {
      console.error("Refinement failed:", error);
    } finally {
      setIsRefining(false);
    }
  };

  const exportFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportText = (item?: SavedPost) => {
    if (!item && !post) return;
    const targetText = item ? item.text : post?.text;
    const targetPrompt = item ? item.imagePrompt : post?.imagePrompt;
    const targetPlatform = item ? item.platform : platform;
    
    const content = `Platform: ${targetPlatform}\n\nPost Content:\n${targetText}\n\nImage Prompt: ${targetPrompt}`;
    exportFile(content, `social-post-${targetPlatform.toLowerCase()}.txt`, "text/plain");
  };

  const handleExportJSON = (item?: SavedPost) => {
    if (!item && !post) return;
    const data = item ? {
      platform: item.platform,
      content: item.text,
      imagePrompt: item.imagePrompt,
      imageUrl: item.imageUrl,
      persona: item.personaName,
      createdAt: item.createdAt,
      adjustments: item.adjustments
    } : {
      platform,
      content: post?.text,
      imagePrompt: post?.imagePrompt,
      imageUrl: post?.imageUrl,
      persona: selectedPersona?.name,
      createdAt: new Date().toISOString(),
      adjustments
    };
    
    const targetPlatform = item ? item.platform : platform;
    exportFile(JSON.stringify(data, null, 2), `social-post-${targetPlatform.toLowerCase()}.json`, "application/json");
  };

  const handleSuggestHashtags = async () => {
    if (!post?.text) return;
    setIsGeneratingHashtags(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following social media post and the target platform "${platform}". 
        Generate 10-15 relevant, high-reaching, and platform-specific hashtags.
        
        Post Content:
        ${post.text}
        
        Return ONLY a JSON array of strings:
        ["#hashtag1", "#hashtag2", ... ]`,
        config: {
          responseMimeType: "application/json"
        }
      });
      const text = response.text || "[]";
      setSuggestedHashtags(JSON.parse(text));
    } catch (error) {
      console.error("Hashtag generation failed:", error);
    } finally {
      setIsGeneratingHashtags(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatting(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [...chatMessages, userMessage].map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: "You are a social media strategist and content expert. Help the user refine their ideas, brainstorm personas, or improve their brand voice."
        }
      });

      const modelMessage = { role: "model" as const, text: response.text || "I'm sorry, I couldn't generate a response." };
      setChatMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat failed:", error);
    } finally {
      setIsChatting(false);
    }
  };

  const selectedPersona = personas.find(p => p.id === selectedPersonaId);
  const selectedVoice = PREDEFINED_VOICES.find(v => v.id === selectedVoiceId);

  const handleAddPersona = async () => {
    if (!newPersona.name || !user) return;
    const id = Date.now().toString();
    const persona: Persona = {
      id,
      name: newPersona.name || "Untitled",
      age: newPersona.age || "",
      location: newPersona.location || "",
      occupation: newPersona.occupation || "",
      interests: newPersona.interests || "",
      painPoints: newPersona.painPoints || "",
      onlineBehavior: newPersona.onlineBehavior || "",
    };
    
    const personaPath = `users/${user.uid}/personas/${id}`;
    try {
      await setDoc(doc(db, personaPath), persona);
      setSelectedPersonaId(persona.id);
      setIsAddingPersona(false);
      setNewPersona({});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, personaPath);
    }
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setBrandLogo(base64);
      
      const configPath = `users/${user.uid}/config/main`;
      try {
        await setDoc(doc(db, configPath), { brandLogo: base64 }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, configPath);
      }
    };
    reader.readAsDataURL(file);
  };

  const generatePost = async () => {
    if (!message || !selectedPersona) return;

    setIsGenerating(true);
    setPost(null);
    setVariations([]);
    setActiveVariationIndex(0);
    setSuggestedHashtags([]);

    const voiceDescription = isCustomVoice ? customVoice : selectedVoice?.description;
    const selectedTemplate = POST_TEMPLATES.find(t => t.id === selectedTemplateId);

    try {
      // 1. Generate Two Variations of Text Content and Image Prompts
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create TWO distinct variations (Variation A and Variation B) of a storytelling-focused social media post for ${platform} to be used in an A/B test.
        
        Core Message: ${message}
        
        ${selectedTemplate ? `Post Template/Type: ${selectedTemplate.name}
        Guidance: ${selectedTemplate.promptGuidance}` : ""}
        
        Target Audience Persona:
        - Name: ${selectedPersona.name}
        - Age: ${selectedPersona.age}
        - Location: ${selectedPersona.location}
        - Occupation: ${selectedPersona.occupation}
        - Interests: ${selectedPersona.interests}
        - Pain Points: ${selectedPersona.painPoints}
        - Online Behavior: ${selectedPersona.onlineBehavior}
        
        Brand Voice:
        ${voiceDescription}
        
        Requirements for BOTH variations:
        1. Start with a strong, attention-grabbing hook tailored to this persona's interests/pain points.
        2. Use a storytelling narrative style that matches the specified brand voice.
        3. Include relevant emojis.
        4. End with a clear call to action.
        5. Use Google Search to ensure any facts or trends mentioned are accurate and up-to-date.
        6. Provide a detailed visual prompt for an AI image generator (unique for each variation). The prompt MUST include:
           - Specific Artistic Style.
           - Camera Angle & Composition.
           - Lighting & Atmosphere.
           - Avoid text in the image.
        
        Format your response as a JSON object with a "variations" array:
        {
          "variations": [
            {
              "text": "variation A text",
              "imagePrompt": "variation A image prompt"
            },
            {
              "text": "variation B text",
              "imagePrompt": "variation B image prompt"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const fullResult = JSON.parse(textResponse.text || "{\"variations\": []}");
      const results = fullResult.variations || [];
      
      const generatedVariations: GeneratedPost[] = [];
      const testGroupId = Date.now().toString();

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const variantLabel = i === 0 ? "A" : "B";
        
        // 2. Generate Image for each variation
        const imageConfig: any = {
          aspectRatio: platform === "Instagram" || platform === "TikTok" ? "9:16" : "16:9",
          imageSize: imageSize
        };

        if (brandLogo) {
          const matches = brandLogo.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (matches) {
            imageConfig.referenceImages = [{
              data: matches[2],
              mimeType: matches[1],
              referenceType: "SUBJECT"
            }];
          }
        }

        const imageResponse = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: {
            parts: [{ text: `${result.imagePrompt}${brandLogo ? ". Subtly incorporate the branding elements from the reference image into the scene (e.g., on a product, as a logo placement, or themed colors)." : ""}` }]
          },
          config: {
            imageConfig: imageConfig
          }
        });

        let imageUrl = "";
        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        generatedVariations.push({
          text: result.text,
          imagePrompt: result.imagePrompt,
          imageUrl: imageUrl,
          testGroupId: testGroupId,
          variant: variantLabel
        });
      }

      setVariations(generatedVariations);
      setPost(generatedVariations[0]);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (post?.text) {
      navigator.clipboard.writeText(post.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Notifications Overlay */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`p-4 rounded-2xl shadow-xl border pointer-events-auto flex items-start gap-3 ${
                n.type === "success" ? "bg-white border-emerald-100" : "bg-white border-slate-100"
              }`}
            >
              <div className={`p-2 rounded-lg ${
                n.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
              }`}>
                {n.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">StoryPost AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("create")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "create" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Create
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === "library" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Library
              </button>
              <button
                onClick={() => setActiveTab("calendar")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === "calendar" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === "chat" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Chat
              </button>
            </nav>

            <div className="h-6 w-[1px] bg-slate-200" />

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end hidden md:flex">
                  <span className="text-[10px] font-bold text-slate-900 leading-none">{user.displayName}</span>
                  <button 
                    onClick={handleLogout}
                    className="text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest mt-1"
                  >
                    Logout
                  </button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                title="Login with Google"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {isAuthLoading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
              <p className="text-slate-500 font-medium">Loading your profile...</p>
            </motion.div>
          ) : !user ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6">
                <LogIn className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome to StoryPost AI</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Unlock persistent personas, brand voices, and your content library by logging in with your Google account.
              </p>
              <button
                onClick={handleLogin}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <LogIn className="w-5 h-5" />
                Get Started for Free
              </button>
            </motion.div>
          ) : activeTab === "create" ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Input Section */}
              <section className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Layout className="w-5 h-5 text-indigo-600" />
                    Campaign Details
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                        <Bookmark className="w-4 h-4" />
                        Industry Template
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {POST_TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplateId(template.id === selectedTemplateId ? null : template.id)}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              selectedTemplateId === template.id
                                ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                : "bg-white border-slate-200 hover:border-indigo-100"
                            }`}
                          >
                            <span className="text-lg block mb-1">{template.emoji}</span>
                            <span className={`text-[10px] font-bold block leading-tight ${
                              selectedTemplateId === template.id ? "text-indigo-600" : "text-slate-600"
                            }`}>
                              {template.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        Core Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What is the main point you want to convey?"
                        className="w-full h-24 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none bg-slate-50/50"
                      />
                    </div>

                    {/* Persona Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Audience Persona
                        </label>
                        <button 
                          onClick={() => setIsAddingPersona(!isAddingPersona)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          {isAddingPersona ? "Cancel" : "+ New Persona"}
                        </button>
                      </div>

                      {isAddingPersona ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4"
                        >
                          <input
                            type="text"
                            placeholder="Persona Name (e.g. Busy Mom)"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200"
                            value={newPersona.name || ""}
                            onChange={e => setNewPersona({...newPersona, name: e.target.value})}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Age"
                              className="px-3 py-2 text-sm rounded-lg border border-slate-200"
                              value={newPersona.age || ""}
                              onChange={e => setNewPersona({...newPersona, age: e.target.value})}
                            />
                            <input
                              type="text"
                              placeholder="Location"
                              className="px-3 py-2 text-sm rounded-lg border border-slate-200"
                              value={newPersona.location || ""}
                              onChange={e => setNewPersona({...newPersona, location: e.target.value})}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Occupation"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200"
                            value={newPersona.occupation || ""}
                            onChange={e => setNewPersona({...newPersona, occupation: e.target.value})}
                          />
                          <textarea
                            placeholder="Interests"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 h-16 resize-none"
                            value={newPersona.interests || ""}
                            onChange={e => setNewPersona({...newPersona, interests: e.target.value})}
                          />
                          <textarea
                            placeholder="Pain Points"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 h-16 resize-none"
                            value={newPersona.painPoints || ""}
                            onChange={e => setNewPersona({...newPersona, painPoints: e.target.value})}
                          />
                          <button 
                            onClick={handleAddPersona}
                            className="w-full py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg"
                          >
                            Save Persona
                          </button>
                        </motion.div>
                      ) : (
                        <select
                          value={selectedPersonaId}
                          onChange={(e) => setSelectedPersonaId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-slate-50/50 text-sm"
                        >
                          {personas.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Brand Voice Selector */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Brand Voice
                      </label>
                      <div className="space-y-2">
                        <select
                          value={isCustomVoice ? "custom" : selectedVoiceId}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setIsCustomVoice(true);
                            } else {
                              setIsCustomVoice(false);
                              setSelectedVoiceId(e.target.value);
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-slate-50/50 text-sm"
                        >
                          {PREDEFINED_VOICES.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                          <option value="custom">Custom Voice...</option>
                        </select>
                        
                        {isCustomVoice && (
                          <motion.textarea
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            value={customVoice}
                            onChange={(e) => setCustomVoice(e.target.value)}
                            placeholder="Describe your brand voice (e.g. 'Energetic, uses slang, focuses on Gen Z trends')"
                            className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none bg-slate-50/50 text-sm"
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Platform
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {platforms.map((p) => (
                          <button
                            key={p}
                            onClick={() => setPlatform(p)}
                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                              platform === p
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Image Quality
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["1K", "2K", "4K"] as const).map((size) => (
                          <button
                            key={size}
                            onClick={() => setImageSize(size)}
                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                              imageSize === size
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Brand Assets Section */}
                    <div className="pt-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2 text-indigo-600 italic">
                        <ImagePlus className="w-4 h-4" />
                        Brand Assets (Subtle Incorporation)
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer group"
                        >
                          {brandLogo ? (
                            <div className="flex items-center gap-3 w-full">
                              <img src={brandLogo} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-slate-200" />
                              <span className="text-xs text-slate-600 font-medium truncate flex-1">Logo Uploaded</span>
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setBrandLogo(null);
                                }}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                              <span className="text-xs text-slate-500 font-medium">Upload Brand Logo / Asset</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={generatePost}
                      disabled={isGenerating || !message || !selectedPersonaId}
                      className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-4"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Crafting your story...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Generate Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* Output Section */}
              <section className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  {post ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-6"
                    >
                      {/* Variation Selector */}
                      {variations.length > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                              <Target className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">A/B Test Variations</h4>
                              <p className="text-[10px] text-slate-500 font-medium">Compare and select your winning post</p>
                            </div>
                          </div>
                          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                            {variations.map((v, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setActiveVariationIndex(idx);
                                  setPost(v);
                                }}
                                className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  activeVariationIndex === idx 
                                    ? "bg-white text-indigo-600 shadow-sm" 
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                Variant {v.variant}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generated Image */}
                      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 group relative">
                        {post.imageUrl ? (
                          <div className="relative overflow-hidden">
                            <motion.img
                              src={post.imageUrl}
                              alt="Generated visual"
                              className="w-full h-auto object-cover max-h-[500px] transition-all duration-300"
                              style={{ 
                                scale: adjustments.zoom / 100,
                                filter: `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) ${
                                  adjustments.filter === "none" ? "" : 
                                  adjustments.filter === "grayscale" ? "grayscale(100%)" :
                                  adjustments.filter === "sepia" ? "sepia(100%)" :
                                  adjustments.filter === "warm" ? "saturate(150%) sepia(20%)" :
                                  adjustments.filter === "cool" ? "saturate(80%) hue-rotate(180deg)" : ""
                                }` 
                              }}
                              referrerPolicy="no-referrer"
                            />
                            
                            {/* Editor Controls Overlay */}
                            <AnimatePresence>
                              {isEditingImage && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm p-6 flex flex-col justify-end"
                                >
                                  <div className="bg-white rounded-2xl p-4 shadow-2xl space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-sm font-bold text-slate-800">Image Adjustments</h4>
                                      <button 
                                        onClick={() => setIsEditingImage(false)}
                                        className="text-slate-400 hover:text-slate-600"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-3">
                                        <Sun className="w-4 h-4 text-slate-400" />
                                        <input 
                                          type="range" min="50" max="150" 
                                          value={adjustments.brightness}
                                          onChange={(e) => setAdjustments({...adjustments, brightness: Number(e.target.value)})}
                                          className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <span className="text-[10px] font-mono w-8">{adjustments.brightness}%</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Contrast className="w-4 h-4 text-slate-400" />
                                        <input 
                                          type="range" min="50" max="150" 
                                          value={adjustments.contrast}
                                          onChange={(e) => setAdjustments({...adjustments, contrast: Number(e.target.value)})}
                                          className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <span className="text-[10px] font-mono w-8">{adjustments.contrast}%</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Maximize2 className="w-4 h-4 text-slate-400" />
                                        <input 
                                          type="range" min="100" max="200" 
                                          value={adjustments.zoom}
                                          onChange={(e) => setAdjustments({...adjustments, zoom: Number(e.target.value)})}
                                          className="flex-1 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <span className="text-[10px] font-mono w-8">{adjustments.zoom}%</span>
                                      </div>
                                    </div>

                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                      {["none", "grayscale", "sepia", "warm", "cool"].map((f) => (
                                        <button
                                          key={f}
                                          onClick={() => setAdjustments({...adjustments, filter: f})}
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all whitespace-nowrap ${
                                            adjustments.filter === f 
                                              ? "bg-indigo-600 text-white" 
                                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                          }`}
                                        >
                                          {f}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          <div className="aspect-video bg-slate-100 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setIsEditingImage(!isEditingImage)}
                            className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg hover:bg-white transition-colors"
                            title="Edit Image"
                          >
                            <SlidersHorizontal className="w-5 h-5 text-slate-700" />
                          </button>
                          <a
                            href={post.imageUrl}
                            download="social-post-image.png"
                            className="p-2 bg-white/90 backdrop-blur rounded-lg shadow-lg hover:bg-white transition-colors shadow-indigo-100/20"
                          >
                            <Download className="w-5 h-5 text-slate-700" />
                          </a>
                        </div>
                      </div>

                      {/* Generated Text */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <Layout className="w-4 h-4" />
                            {platform} Post
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100 mr-2">
                              <button
                                onClick={() => handleRefinePost("refine")}
                                disabled={isRefining}
                                className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-95 disabled:opacity-50"
                                title="Refine/Improve"
                              >
                                <Wand2 className={`w-4 h-4 ${isRefining ? "animate-pulse" : ""}`} />
                              </button>
                              <button
                                onClick={() => handleRefinePost("expand")}
                                disabled={isRefining}
                                className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-95 disabled:opacity-50"
                                title="Expand Content"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRefinePost("shorten")}
                                disabled={isRefining}
                                className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-95 disabled:opacity-50"
                                title="Shorten/Punchy"
                              >
                                <ArrowDownLeft className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-100">
                              <button
                                onClick={handleExportText}
                                className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-95"
                                title="Export as Text"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleExportJSON}
                                className="p-2 hover:bg-white hover:text-indigo-600 rounded-lg text-slate-500 transition-all active:scale-95"
                                title="Export as JSON"
                              >
                                <FileCode className="w-4 h-4" />
                              </button>
                            </div>
                            <button
                              onClick={copyToClipboard}
                              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg"
                            >
                              {copied ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span className="text-emerald-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {showRefinements && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mb-6 bg-indigo-50/50 rounded-xl border border-indigo-100 p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                  <Sparkles className="w-3 h-3" />
                                  AI Variations
                                </h4>
                                <button 
                                  onClick={() => setShowRefinements(false)}
                                  className="text-indigo-400 hover:text-indigo-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              
                              {isRefining ? (
                                <div className="flex flex-col items-center py-4 space-y-2">
                                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                                  <span className="text-[10px] font-medium text-indigo-400">Refining your voice...</span>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {refinementSuggestions.map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        if (post) {
                                          setPost({ ...post, text: suggestion });
                                        }
                                        setShowRefinements(false);
                                      }}
                                      className="w-full text-left p-3 bg-white rounded-lg border border-indigo-100 text-xs text-slate-600 hover:border-indigo-400 hover:shadow-sm transition-all group relative"
                                    >
                                      <div className="line-clamp-2 pr-6">{suggestion}</div>
                                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-3 h-3 text-indigo-500" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Hashtag Suggestions */}
                        <div className="mb-6 px-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              Smart Hashtags
                            </h4>
                            <button
                              onClick={handleSuggestHashtags}
                              disabled={isGeneratingHashtags}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              {isGeneratingHashtags ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              {suggestedHashtags.length > 0 ? "Refresh" : "Generate Tags"}
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {suggestedHashtags.map((tag, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (post) {
                                    setPost({ ...post, text: post.text + "\n\n" + tag });
                                    setSuggestedHashtags(prev => prev.filter(t => t !== tag));
                                  }
                                }}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95"
                              >
                                {tag}
                              </button>
                            ))}
                            {suggestedHashtags.length === 0 && !isGeneratingHashtags && (
                              <p className="text-[10px] text-slate-400 italic">No hashtags suggested yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="prose prose-slate max-w-none px-4">
                          <p className="whitespace-pre-wrap text-slate-800 leading-relaxed text-lg">
                            {post.text}
                          </p>
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                              <ImageIcon className="w-3 h-3" />
                              Visual Prompt
                            </h4>
                            <p className="text-sm text-slate-500 italic leading-snug">
                              "{post.imagePrompt}"
                            </p>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                              <Calendar className="w-3 h-3" />
                              Schedule (Optional)
                            </h4>
                            <input
                              type="datetime-local"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50"
                            />
                            <div className="flex gap-2">
                              {variations.length > 1 ? (
                                <button
                                  onClick={handleSaveAllVariations}
                                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                >
                                  <Bookmark className="w-4 h-4" />
                                  Save A/B Test Group
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSavePost()}
                                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                >
                                  <Bookmark className="w-4 h-4" />
                                  Save to Library
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={generatePost}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate Version
                      </button>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[400px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-indigo-200" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">Ready to create?</h3>
                      <p className="text-slate-500 max-w-xs">
                        Fill in your campaign details and we'll generate a storytelling post with a custom image.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </section>
            </motion.div>
          ) : activeTab === "library" ? (
            <motion.div
              key="library"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Content Library</h2>
                  <p className="text-slate-500">Manage your saved and scheduled posts</p>
                </div>
                <button
                  onClick={() => setActiveTab("create")}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Post
                </button>
              </div>

              {savedPosts.length === 0 ? (
                <div className="py-20 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Bookmark className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Your library is empty</h3>
                  <p className="text-slate-500 max-w-xs mt-2">
                    Start generating content and save your favorite versions here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {savedPosts.map((saved) => (
                    <motion.div
                      key={saved.id}
                      layout
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="aspect-video relative overflow-hidden bg-slate-100">
                        {saved.imageUrl && (
                          <img 
                            src={saved.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover transition-all"
                            style={{ 
                              scale: saved.adjustments?.zoom ? saved.adjustments.zoom / 100 : 1,
                              filter: saved.adjustments ? `brightness(${saved.adjustments.brightness}%) contrast(${saved.adjustments.contrast}%) ${
                                saved.adjustments.filter === "none" ? "" : 
                                saved.adjustments.filter === "grayscale" ? "grayscale(100%)" :
                                saved.adjustments.filter === "sepia" ? "sepia(100%)" :
                                saved.adjustments.filter === "warm" ? "saturate(150%) sepia(20%)" :
                                saved.adjustments.filter === "cool" ? "saturate(80%) hue-rotate(180deg)" : ""
                              }` : "none"
                            }}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="px-2 py-1 bg-white/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm">
                            {saved.platform}
                          </span>
                          {saved.status === "scheduled" && (
                            <span className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Scheduled
                            </span>
                          )}
                          {saved.status === "published" && (
                            <span className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Published
                            </span>
                          )}
                          {saved.variant && (
                            <span className="px-2 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Variant {saved.variant}
                            </span>
                          )}
                        </div>
                        {saved.imageUrl && (
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={saved.imageUrl}
                              download={`social-post-image-${saved.id}.png`}
                              className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm hover:bg-white transition-colors block"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-700" />
                            </a>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Persona: {saved.personaName}
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {saved.status === "scheduled" && (
                              <button 
                                onClick={() => triggerPublish(saved)}
                                className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-500 transition-colors"
                                title="Publish Now"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleExportText(saved)}
                              className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-400 transition-colors"
                              title="Export Text"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExportJSON(saved)}
                              className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-400 transition-colors"
                              title="Export JSON"
                            >
                              <FileCode className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingPostId(saved.id)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeletePost(saved.id)}
                              className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {editingPostId === saved.id ? (
                          <div className="space-y-3">
                            <textarea
                              defaultValue={saved.text}
                              id={`edit-${saved.id}`}
                              className="w-full h-32 p-3 text-sm border border-indigo-200 rounded-xl bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const val = (document.getElementById(`edit-${saved.id}`) as HTMLTextAreaElement).value;
                                  handleUpdatePost(saved.id, val);
                                }}
                                className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={() => setEditingPostId(null)}
                                className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                            {saved.text}
                          </p>
                        )}

                        {saved.scheduledAt && (
                          <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                            <Calendar className="w-3 h-3" />
                            {new Date(saved.scheduledAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === "calendar" ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Content Calendar</h2>
                  <p className="text-slate-500">Plan your social media strategy</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
                    {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button 
                    onClick={() => setCurrentCalendarDate(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 1))}
                    className="p-2 hover:bg-slate-50 rounded-lg transition-colors rotate-180"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {(() => {
                    const year = currentCalendarDate.getFullYear();
                    const month = currentCalendarDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days = [];

                    // Padding for previous month
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<div key={`pad-${i}`} className="h-32 border-r border-b border-slate-50 bg-slate-50/30" />);
                    }

                    // Days of current month
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = new Date(year, month, d).toDateString();
                      const dayPosts = savedPosts.filter(p => {
                        if (!p.scheduledAt) return false;
                        return new Date(p.scheduledAt).toDateString() === dateStr;
                      });

                      days.push(
                        <div key={d} className="h-32 border-r border-b border-slate-100 p-2 hover:bg-slate-50/50 transition-colors group relative">
                          <span className={`text-xs font-bold ${
                            new Date().toDateString() === dateStr ? "text-indigo-600 bg-indigo-50 w-6 h-6 flex items-center justify-center rounded-full" : "text-slate-400"
                          }`}>
                            {d}
                          </span>
                          <div className="mt-1 space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                            {dayPosts.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setActiveTab("library");
                                  setEditingPostId(p.id);
                                  // Small delay to ensure scroll to post if we had many
                                }}
                                className={`w-full text-left px-1.5 py-1 rounded text-[9px] font-bold truncate flex items-center gap-1 transition-all hover:scale-[1.02] ${
                                  p.status === "published" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                }`}
                              >
                                <div className={`w-1 h-1 rounded-full ${p.status === "published" ? "bg-emerald-400" : "bg-indigo-400"}`} />
                                {p.platform}: {p.text.substring(0, 15)}...
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return days;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-6 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-400" />
                  <span className="text-xs font-medium text-slate-500">Scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-slate-500">Published</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Strategy Assistant</h3>
                    <p className="text-xs text-slate-500">Brainstorm ideas and refine your voice</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                        <Bell className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 text-sm max-w-xs">
                        Ask me anything about your social media strategy, personas, or brand voice.
                      </p>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                        m.role === "user" 
                          ? "bg-indigo-600 text-white rounded-tr-none" 
                          : "bg-slate-100 text-slate-800 rounded-tl-none"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isChatting}
                      className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-slate-200 mt-12 text-center">
        <p className="text-sm text-slate-400">
          Powered by Gemini 3 & 2.5 Flash • Built for Creative Professionals
        </p>
      </footer>
    </div>
  );
}
