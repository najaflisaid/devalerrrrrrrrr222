import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, getSecondaryAuth } from '../lib/firebase';
import type { User, B2BRequest } from '../types';

export const userService = {
  async register(email: string, password: string, userData: Partial<User>): Promise<void> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await addDoc(collection(db, 'users'), {
      ...userData,
      id: userCredential.user.uid,
      email,
      role: userData.role || 'customer',
      createdAt: new Date()
    });
  },

  async registerForAdmin(email: string, password: string, userData: Partial<User>): Promise<void> {
    const secondaryAuth = getSecondaryAuth();
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await addDoc(collection(db, 'users'), {
      ...userData,
      id: userCredential.user.uid,
      email,
      role: userData.role || 'customer',
      createdAt: new Date()
    });
    await signOut(secondaryAuth);
  },

  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  async submitB2BRequest(request: Omit<B2BRequest, 'id' | 'status' | 'created_at'> & { password: string }): Promise<void> {
    await addDoc(collection(db, 'b2bRequests'), {
      ...request,
      status: 'pending',
      created_at: new Date()
    });
  },

  async getB2BRequests(): Promise<B2BRequest[]> {
    const querySnapshot = await getDocs(collection(db, 'b2bRequests'));
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate ? data.created_at.toDate() : (data.created_at || new Date())
      };
    }) as B2BRequest[];
  },

  async approveB2BRequest(requestId: string): Promise<void> {
    const requestDoc = await getDocs(query(collection(db, 'b2bRequests'), where('__name__', '==', requestId)));

    if (!requestDoc.empty) {
      const requestData = requestDoc.docs[0].data();

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, requestData.email, requestData.password);

        await addDoc(collection(db, 'users'), {
          id: userCredential.user.uid,
          email: requestData.email,
          name: requestData.first_name,
          surname: requestData.last_name,
          phone: requestData.phone,
          role: 'b2b',
          status: 'active',
          isB2BApproved: true,
          companyName: requestData.company_name,
          createdAt: new Date()
        });

        const docRef = doc(db, 'b2bRequests', requestId);
        await updateDoc(docRef, { status: 'approved' });
      } catch (error) {
        console.error('Error creating B2B user:', error);
        throw error;
      }
    }
  },

  async rejectB2BRequest(requestId: string): Promise<void> {
    const docRef = doc(db, 'b2bRequests', requestId);
    await updateDoc(docRef, { status: 'rejected' });
  },

  async toggleB2BStatus(userId: string, newStatus: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, { status: newStatus });
  },

  async getAllUsers(): Promise<User[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
        };
      }) as User[];
      console.log('getAllUsers returned:', users);
      return users;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await deleteDoc(userDoc.ref);
      }

      console.log('User deleted from Firestore successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  async setUserRole(userId: string, role: 'customer' | 'admin' | 'b2b'): Promise<void> {
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
    if (!usersSnapshot.empty) {
      await updateDoc(usersSnapshot.docs[0].ref, { role });
    } else {
      throw new Error('İstifadəçi tapılmadı');
    }
  },

  async updateUserDiscount(
    userId: string,
    discountPercentage: number,
    discountUsageType?: string,
    discountExpiresAt?: string | null
  ): Promise<void> {
    try {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const updateData: any = {
          discountPercentage,
          discountUsed: false
        };

        if (discountUsageType) {
          updateData.discountUsageType = discountUsageType;
        }

        if (discountExpiresAt) {
          updateData.discountExpiresAt = new Date(discountExpiresAt);
        } else {
          updateData.discountExpiresAt = null;
        }

        await updateDoc(userDoc.ref, updateData);
      }
    } catch (error) {
      console.error('Error updating user discount:', error);
      throw error;
    }
  }
};