// `onClick` added so the tiles actually go somewhere. They had a hover effect
// and no handler — six tiles that looked interactive and ignored every click.
// Rendered as a <button> when clickable so keyboard focus and Enter/Space work
// without extra handlers. See CLAUDE.md CF-35.
export default function CategoryCard({ name, image, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={onClick ? `Shop ${name}` : undefined}
      className={`
        relative
        flex items-center justify-center
        overflow-hidden
        rounded-2xl
        mt-[3vw] mb-[3vw]
        transition-transform duration-300
        w-[clamp(170px,20vw,250px)]
        h-[clamp(170px,20vw,250px)]
        bg-center bg-cover
        group
        ${onClick ? "cursor-pointer hover:scale-105" : ""}
      `}
      style={{ backgroundImage: `url(${image})` }}
    >
      {/* Overlay ( ::before equivalent ) */}
      <div
        className="
          absolute inset-0
          bg-white/30
          transition-colors duration-300
          group-hover:bg-white/0
          z-1
        "
      />

      {/* Label */}
      <div className="relative z-2 text-center">
        <h2
          className="
            text-[#68232B]
            font-bold
            text:md
            md:text-xl
          "
        >
          {name}
        </h2>
      </div>
    </Tag>
  );
}
