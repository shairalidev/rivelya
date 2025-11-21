const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'RV';
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
};

export default function Avatar({ src, name, alt, className = '', size = 'medium', ...props }) {
  const initials = getInitials(name);
  const sizeClass = `avatar--${size}`;
  
  return (
    <div className={`avatar ${sizeClass} ${className}`} {...props}>
      {src ? (
        <img 
          src={src} 
          alt={alt || name || 'Avatar'} 
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      <span className="avatar-initials" style={src ? { display: 'none' } : {}}>
        {initials}
      </span>
    </div>
  );
}