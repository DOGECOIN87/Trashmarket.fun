import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../firebase.config';
import { CollectionSubmission, SubmissionStatus } from '../types';

// Constants
const SUBMISSIONS_COLLECTION = 'submissions';
const MAX_SUBMISSIONS_PER_WALLET = 3;
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Helper function to validate image files
const validateImageFile = (file: File): void => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
  }
  if (file.size > IMAGE_MAX_SIZE) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
};

// Upload image to Firebase Storage
const uploadImage = async (file: File, path: string): Promise<string> => {
  validateImageFile(file);
  
  const imageRef = ref(storage, `submissions/${path}`);
  const snapshot = await uploadBytes(imageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};

// Submit a new collection
export const submitCollection = async (
  submissionData: Omit<CollectionSubmission, 'id' | 'submittedAt' | 'status' | 'submissionCount'>,
  logoFile?: File,
  bannerFile?: File,
  sampleFiles?: File[]
): Promise<string> => {
  try {
    // Check submission count limit
    const submissionCount = await getSubmissionCount(submissionData.submittedBy);
    if (submissionCount >= MAX_SUBMISSIONS_PER_WALLET) {
      throw new Error(`Maximum ${MAX_SUBMISSIONS_PER_WALLET} submissions allowed per wallet.`);
    }

    // Upload images
    let logoUrl = '';
    let bannerUrl = '';
    const sampleImageUrls: string[] = [];

    if (logoFile) {
      logoUrl = await uploadImage(logoFile, `${submissionData.submittedBy}/${submissionData.name}/logo`);
    }
    if (bannerFile) {
      bannerUrl = await uploadImage(bannerFile, `${submissionData.submittedBy}/${submissionData.name}/banner`);
    }
    if (sampleFiles && sampleFiles.length > 0) {
      for (let i = 0; i < sampleFiles.length; i++) {
        const url = await uploadImage(sampleFiles[i], `${submissionData.submittedBy}/${submissionData.name}/sample-${i}`);
        sampleImageUrls.push(url);
      }
    }

    // Prepare submission data
    const submission: Omit<CollectionSubmission, 'id'> = {
      ...submissionData,
      logoUrl,
      bannerUrl,
      sampleImages: sampleImageUrls,
      status: SubmissionStatus.PENDING,
      submittedAt: new Date().toISOString(),
      submissionCount: submissionCount + 1
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), {
      ...submission,
      submittedAt: Timestamp.now()
    });

    // TODO: Send email notification to admin
    // await sendEmailNotification('new_submission', { submissionId: docRef.id });

    return docRef.id;
  } catch (error) {
    console.error('Error submitting collection:', error);
    throw error;
  }
};

// Get submission count for a wallet
export const getSubmissionCount = async (walletAddress: string): Promise<number> => {
  try {
    const submissionsQuery = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('submittedBy', '==', walletAddress)
    );
    
    const querySnapshot = await getDocs(submissionsQuery);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting submission count:', error);
    return 0;
  }
};

// Get all pending submissions (for admin)
export const getPendingSubmissions = async (): Promise<CollectionSubmission[]> => {
  try {
    const pendingQuery = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('status', '==', SubmissionStatus.PENDING),
      orderBy('submittedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(pendingQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CollectionSubmission[];
  } catch (error) {
    console.error('Error getting pending submissions:', error);
    return [];
  }
};

// Get submissions by wallet (for user dashboard)
export const getSubmissionsByWallet = async (walletAddress: string): Promise<CollectionSubmission[]> => {
  try {
    const walletQuery = query(
      collection(db, SUBMISSIONS_COLLECTION),
      where('submittedBy', '==', walletAddress),
      orderBy('submittedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(walletQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CollectionSubmission[];
  } catch (error) {
    console.error('Error getting wallet submissions:', error);
    return [];
  }
};

// Get single submission
export const getSubmission = async (submissionId: string): Promise<CollectionSubmission | null> => {
  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CollectionSubmission;
    }
    return null;
  } catch (error) {
    console.error('Error getting submission:', error);
    return null;
  }
};

// Approve submission (admin only)
export const approveSubmission = async (
  submissionId: string, 
  adminWallet: string,
  notes?: string
): Promise<void> => {
  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
      status: SubmissionStatus.APPROVED,
      reviewedAt: Timestamp.now(),
      reviewedBy: adminWallet,
      reviewNotes: notes || ''
    });

    // TODO: Send approval email notification
    // const submission = await getSubmission(submissionId);
    // if (submission) {
    //   await sendEmailNotification('submission_approved', { 
    //     submissionId, 
    //     email: submission.contactEmail 
    //   });
    // }
  } catch (error) {
    console.error('Error approving submission:', error);
    throw error;
  }
};

// Reject submission (admin only)
export const rejectSubmission = async (
  submissionId: string, 
  adminWallet: string,
  notes: string = ''
): Promise<void> => {
  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
      status: SubmissionStatus.REJECTED,
      reviewedAt: Timestamp.now(),
      reviewedBy: adminWallet,
      reviewNotes: notes
    });

    // TODO: Send rejection email notification
    // const submission = await getSubmission(submissionId);
    // if (submission) {
    //   await sendEmailNotification('submission_rejected', { 
    //     submissionId, 
    //     email: submission.contactEmail,
    //     notes
    //   });
    // }
  } catch (error) {
    console.error('Error rejecting submission:', error);
    throw error;
  }
};

// Delete submission (admin only - for cleanup)
export const deleteSubmission = async (submissionId: string): Promise<void> => {
  try {
    const submission = await getSubmission(submissionId);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // Delete images from storage
    if (submission.logoUrl) {
      await deleteObject(ref(storage, submission.logoUrl));
    }
    if (submission.bannerUrl) {
      await deleteObject(ref(storage, submission.bannerUrl));
    }
    for (const imageUrl of submission.sampleImages) {
      await deleteObject(ref(storage, imageUrl));
    }

    // Delete document from Firestore
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting submission:', error);
    throw error;
  }
};

// Real-time subscription for pending submissions (admin dashboard)
export const subscribeToPendingSubmissions = (
  callback: (submissions: CollectionSubmission[]) => void
) => {
  const pendingQuery = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('status', '==', SubmissionStatus.PENDING),
    orderBy('submittedAt', 'desc')
  );
  
  return onSnapshot(pendingQuery, (querySnapshot) => {
    const submissions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CollectionSubmission[];
    
    callback(submissions);
  });
};

// Email notification placeholder (for future implementation)
const sendEmailNotification = async (
  type: 'new_submission' | 'submission_approved' | 'submission_rejected',
  data: any
): Promise<void> => {
  // TODO: Implement email service integration
  // Examples: SendGrid, Resend, Postmark, etc.
  
  switch (type) {
    case 'new_submission':
      console.log('[EMAIL] New submission received:', data);
      break;
    case 'submission_approved':
      console.log('[EMAIL] Submission approved:', data);
      break;
    case 'submission_rejected':
      console.log('[EMAIL] Submission rejected:', data);
      break;
  }
  
  // For now, just log the notification
  // Future implementation:
  // await emailService.send({
  //   to: data.email,
  //   subject: getEmailSubject(type),
  //   html: getEmailTemplate(type, data)
  // });
};

// Get submission statistics
export const getSubmissionStats = async () => {
  try {
    const allSubmissionsQuery = query(collection(db, SUBMISSIONS_COLLECTION));
    const querySnapshot = await getDocs(allSubmissionsQuery);
    const submissions = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CollectionSubmission[];

    const stats = {
      total: submissions.length,
      pending: submissions.filter(s => s.status === SubmissionStatus.PENDING).length,
      approved: submissions.filter(s => s.status === SubmissionStatus.APPROVED).length,
      rejected: submissions.filter(s => s.status === SubmissionStatus.REJECTED).length,
      byWallet: {} as Record<string, number>
    };

    // Count submissions per wallet
    submissions.forEach(submission => {
      if (stats.byWallet[submission.submittedBy]) {
        stats.byWallet[submission.submittedBy]++;
      } else {
        stats.byWallet[submission.submittedBy] = 1;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error getting submission stats:', error);
    return {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      byWallet: {}
    };
  }
};

export default {
  submitCollection,
  getSubmissionCount,
  getPendingSubmissions,
  getSubmissionsByWallet,
  getSubmission,
  approveSubmission,
  rejectSubmission,
  deleteSubmission,
  subscribeToPendingSubmissions,
  getSubmissionStats
};
