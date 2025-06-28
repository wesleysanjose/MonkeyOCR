import React from 'react';

export interface ChatPrompt {
  label: string;
  value: string;
  instruction: string;
}

interface ChatInterfaceProps {
  prompts: ChatPrompt[];
  selectedPrompt: ChatPrompt;
  onPromptChange: (prompt: ChatPrompt) => void;
  onChat: () => void;
  disabled?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  prompts,
  selectedPrompt,
  onPromptChange,
  onChat,
  disabled = false,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="prompt-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Prompt (选择Prompt)
        </label>
        <select
          id="prompt-select"
          value={selectedPrompt.value}
          onChange={(e) => {
            const prompt = prompts.find(p => p.value === e.target.value);
            if (prompt) onPromptChange(prompt);
          }}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {prompts.map((prompt) => (
            <option key={prompt.value} value={prompt.value}>
              {prompt.label}
            </option>
          ))}
        </select>
      </div>
      
      <button
        onClick={onChat}
        disabled={disabled}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        💬 Chat (对话)
      </button>
    </div>
  );
};