import React, { useState } from 'react';

const Dropdown = ({ options, onSelect, defaultValue, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    defaultValue || (options.length > 0 ? options[0] : null)
  );

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    if (onSelect) onSelect(option);
  };

  return (
    <div className={`dropdown-container ${className || ''}`}>
      <div className="dropdown-header" onClick={handleToggle}>
        {selectedOption ? selectedOption.name : 'Выберите сервер...'}
        <span className="dropdown-arrow">▼</span>
      </div>
      {isOpen && (
        <ul className="dropdown-list">
          {options.map((option) => (
            <li
              key={option.id} 
              className="dropdown-item"
              onClick={() => handleSelect(option)}
            >
              {option.name} {/* Отображаем только имя */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;