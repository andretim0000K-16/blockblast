import { useState } from 'react';

interface FeedbackFormProps {
  onSubmit: (data: { name: string; email: string; subject: string; message: string }) => void;
}

export default function FeedbackForm({ onSubmit }: FeedbackFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Введите ваше имя';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Имя должно содержать минимум 2 символа';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Введите email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Введите корректный email';
    }

    if (!formData.subject) {
      newErrors.subject = 'Выберите тему';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Введите сообщение';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Сообщение должно содержать минимум 10 символов';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    // Имитация отправки на сервер
    await new Promise((resolve) => setTimeout(resolve, 1500));

    onSubmit(formData);
    setIsSubmitting(false);
    setIsSubmitted(true);

    // Сброс формы через 3 секунды
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitted(false);
    }, 3000);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Убираем ошибку при вводе
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (isSubmitted) {
    return (
      <div
        className="text-center p-8 bg-green-500/20 border border-green-500/30 rounded-2xl"
        style={{ animation: 'fadeIn 0.5s ease-out' }}
      >
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-[#1dd1a1] mb-2">Спасибо за отзыв!</h3>
        <p className="text-gray-300">Ваше сообщение успешно отправлено</p>
      </div>
    );
  }

  return (
    <div className="bg-black/30 rounded-3xl border border-white/10 p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">
          <span className="bg-clip-text text-transparent" style={{
            backgroundImage: 'linear-gradient(90deg, #48dbfb, #1dd1a1)',
          }}>
            Обратная связь
          </span>
        </h2>
        <p className="text-gray-400 text-sm">
          Есть вопросы, предложения или нашли ошибку? Напишите нам!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Имя */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Ваше имя <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
              errors.name
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-white/10 focus:ring-[#48dbfb]/50 focus:border-[#48dbfb]/50'
            }`}
            placeholder="Иван Иванов"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-400" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {errors.name}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
              errors.email
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-white/10 focus:ring-[#48dbfb]/50 focus:border-[#48dbfb]/50'
            }`}
            placeholder="ivan@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-400" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {errors.email}
            </p>
          )}
        </div>

        {/* Тема */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
            Тема <span className="text-red-400">*</span>
          </label>
          <select
            id="subject"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all ${
              errors.subject
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-white/10 focus:ring-[#48dbfb]/50 focus:border-[#48dbfb]/50'
            }`}
          >
            <option value="" className="bg-[#24243e]">
              Выберите тему
            </option>
            <option value="question" className="bg-[#24243e]">
              Вопрос
            </option>
            <option value="suggestion" className="bg-[#24243e]">
              Предложение
            </option>
            <option value="bug" className="bg-[#24243e]">
              Ошибка
            </option>
            <option value="other" className="bg-[#24243e]">
              Другое
            </option>
          </select>
          {errors.subject && (
            <p className="mt-1 text-sm text-red-400" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {errors.subject}
            </p>
          )}
        </div>

        {/* Сообщение */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
            Сообщение <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            rows={5}
            className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all resize-none ${
              errors.message
                ? 'border-red-500 focus:ring-red-500/50'
                : 'border-white/10 focus:ring-[#48dbfb]/50 focus:border-[#48dbfb]/50'
            }`}
            placeholder="Расскажите подробнее..."
          />
          {errors.message && (
            <p className="mt-1 text-sm text-red-400" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {errors.message}
            </p>
          )}
        </div>

        {/* Кнопка отправки */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-6 bg-gradient-to-r from-[#48dbfb] to-[#1dd1a1] rounded-xl text-white font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Отправка...
            </span>
          ) : (
            'Отправить сообщение'
          )}
        </button>
      </form>
    </div>
  );
}
