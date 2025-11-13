import PropTypes from 'prop-types';
import Select from 'react-select';

const baseStyles = {
  control: (provided, state) => ({
    ...provided,
    borderRadius: 14,
    borderColor: state.isFocused ? '#7485ff' : 'rgba(120, 137, 184, 0.35)',
    background: 'rgba(14, 21, 32, 0.72)',
    minHeight: 46,
    color: '#f6f8ff',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(116, 133, 255, 0.25)' : 'none',
    transition: 'all 0.2s ease',
    paddingLeft: 2,
    paddingRight: 2
  }),
  singleValue: provided => ({
    ...provided,
    color: '#f6f8ff'
  }),
  input: provided => ({
    ...provided,
    color: '#f6f8ff'
  }),
  placeholder: provided => ({
    ...provided,
    color: 'rgba(199, 208, 255, 0.5)'
  }),
  menu: provided => ({
    ...provided,
    background: 'rgba(12, 19, 30, 0.96)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 28px 60px -30px rgba(12, 18, 27, 0.9)'
  }),
  option: (provided, state) => ({
    ...provided,
    background: state.isFocused ? 'rgba(116, 133, 255, 0.18)' : 'transparent',
    color: state.isFocused ? '#f6f8ff' : 'rgba(238, 240, 255, 0.86)',
    cursor: 'pointer',
    paddingTop: 10,
    paddingBottom: 10
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? '#aab4ff' : 'rgba(199, 208, 255, 0.7)'
  }),
  menuList: provided => ({
    ...provided,
    paddingTop: 6,
    paddingBottom: 6
  })
};

export default function FancySelect({ name, value, options, onChange, placeholder, isDisabled = false }) {
  const selected = options.find(option => option.value === value) || null;

  const handleChange = option => {
    if (onChange) {
      onChange({ target: { name, value: option ? option.value : '' } });
    }
  };

  return (
    <Select
      classNamePrefix="fancy-select"
      value={selected}
      options={options}
      placeholder={placeholder}
      isDisabled={isDisabled}
      onChange={handleChange}
      styles={baseStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPlacement="auto"
    />
  );
}

FancySelect.propTypes = {
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  isDisabled: PropTypes.bool
};
