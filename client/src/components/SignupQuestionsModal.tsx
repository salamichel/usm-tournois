import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { TournamentQuestion, QuestionResponse } from '@shared/types';

interface SignupQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (responses: QuestionResponse[]) => void;
  questions: TournamentQuestion[];
  isLoading?: boolean;
  title?: string;
}

const SignupQuestionsModal = ({
  isOpen,
  onClose,
  onSubmit,
  questions,
  isLoading = false,
  title = "Questions d'inscription",
}: SignupQuestionsModalProps) => {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset responses when modal opens
  useEffect(() => {
    if (isOpen) {
      setResponses({});
      setErrors({});
    }
  }, [isOpen]);

  const handleOptionSelect = (questionId: string, optionId: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
    // Clear error when user selects an option
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateAndSubmit = () => {
    const newErrors: Record<string, string> = {};

    // Check required questions
    questions.forEach((question) => {
      if (question.required && !responses[question.id]) {
        newErrors[question.id] = 'Cette question est obligatoire';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build response array
    const questionResponses: QuestionResponse[] = questions
      .filter((q) => responses[q.id])
      .map((q) => ({
        questionId: q.id,
        selectedOptionId: responses[q.id],
        selectedOptionLabel: q.options.find((o) => o.id === responses[q.id])?.label,
      }));

    onSubmit(questionResponses);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            disabled={isLoading}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <p className="text-sm text-gray-600 mb-4">
            Merci de répondre aux questions suivantes pour compléter votre inscription.
          </p>

          <div className="space-y-6">
            {questions.map((question, index) => (
              <div key={question.id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                  {index + 1}. {question.question}
                  {question.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="space-y-2">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        responses[question.id] === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={responses[question.id] === option.id}
                        onChange={() => handleOptionSelect(question.id, option.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-3 text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors[question.id] && (
                  <p className="text-red-500 text-sm">{errors[question.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={validateAndSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Inscription...' : "Valider l'inscription"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignupQuestionsModal;
