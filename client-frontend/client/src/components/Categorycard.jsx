export default function CategoryCard({ name, image }) {
  return (
    <div
      className="
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
      "
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
    </div>
  );
}
