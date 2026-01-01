import React from "react";
import footerBg from "../assets/footerbgimage.webp";

const ReviewCard = ({ review }) => {
  return (
    <div
      className="
        flex items-center
        w-[90%] lg:w-[70%]
        rounded-4xl
        text-white
        overflow-hidden
        bg-cover bg-center bg-fixed
      "
      style={{ backgroundImage: `url(${footerBg})` }}
    >
      {/* LEFT SECTION */}
      <div
        className="
          aspect-square
          overflow-hidden
          rounded-4xl
          h-[25vw]
          m-[2vw]
          w-fit
          shrink-0
        "
      >
        <img
          src={review.image}
          alt={review.name}
          className="w-full h-full object-cover block"
        />
      </div>

      {/* RIGHT SECTION */}
      <div
        className="
          flex flex-col justify-center
          flex-3
          p-4
        "
      >
        <h2 className="text-lg md:text-4xl m-[0.5vw]">
          {review.name}
        </h2>

        <div className="text-lg md:text-3xl m-[0.5vw]">
          {"⭐".repeat(review.rating)}
        </div>

        <p className="text-xs md:text-xl m-[0.5vw]">
          {review.description}
        </p>
      </div>
    </div>
  );
};

export default ReviewCard;
