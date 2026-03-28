import React, { useState, useEffect } from 'react';
import { Loader2, Mail, Trash2, Check, Eye } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  createdAt: Date;
}

const ContactMessagesTab: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const q = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date()
      })) as ContactMessage[];
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'contact_messages', id), { status: 'read' });
      loadMessages();
    } catch (error) {
      console.error('Error updating message:', error);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Bu müraciəti silmək istəyirsiniz?')) return;
    try {
      await deleteDoc(doc(db, 'contact_messages', id));
      loadMessages();
      setSelectedMessage(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Müraciətlər</h2>

      {messages.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Hələ müraciət yoxdur</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Messages List */}
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (msg.status === 'new') markAsRead(msg.id);
                }}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedMessage?.id === msg.id 
                    ? 'border-gray-900 bg-gray-50' 
                    : msg.status === 'new' 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{msg.name}</p>
                    <p className="text-sm text-gray-600">{msg.subject}</p>
                  </div>
                  {msg.status === 'new' && (
                    <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Yeni</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {msg.createdAt.toLocaleDateString('az-AZ')} {msg.createdAt.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>

          {/* Message Detail */}
          {selectedMessage && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{selectedMessage.subject}</h3>
                <button
                  onClick={() => deleteMessage(selectedMessage.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Ad:</span>
                  <span className="ml-2 text-gray-900">{selectedMessage.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <a href={`mailto:${selectedMessage.email}`} className="ml-2 text-blue-600 hover:underline">
                    {selectedMessage.email}
                  </a>
                </div>
                {selectedMessage.phone && (
                  <div>
                    <span className="text-gray-500">Telefon:</span>
                    <a href={`tel:${selectedMessage.phone}`} className="ml-2 text-blue-600 hover:underline">
                      {selectedMessage.phone}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Tarix:</span>
                  <span className="ml-2 text-gray-900">
                    {selectedMessage.createdAt.toLocaleDateString('az-AZ')} {selectedMessage.createdAt.toLocaleTimeString('az-AZ')}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-gray-500 text-sm mb-2">Mesaj:</p>
                <p className="text-gray-900 whitespace-pre-line">{selectedMessage.message}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContactMessagesTab;
