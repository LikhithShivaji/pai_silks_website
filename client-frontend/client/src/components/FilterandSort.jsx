import React, { useState } from "react";
import footerBg from "../assets/footerbgimage.svg";

// UI Components
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// Icons (Using Lucide for a cleaner, scalable look)
import { X, ChevronDown, ChevronUp, Filter } from "lucide-react";

const FilterAndSort = ({
  onFilterChange,
  onSortChange,
  categories,
  onClose,
}) => {
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortOption, setSortOption] = useState("");

  // Section Open States
  const [openSections, setOpenSections] = useState({
    price: true,
    category: false,
    sort: false,
  });

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleApply = () => {
    onFilterChange({
      minPrice,
      maxPrice,
      categories: selectedCategories,
    });
    onSortChange(sortOption);
    onClose();
  };

  const handleClear = () => {
    setMinPrice(0);
    setMaxPrice(10000);
    setSelectedCategories([]);
    setSortOption("");
  };

  return (
    // Overlay Backdrop
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300">
      
      {/* Sidebar Container */}
      <div
        className="
          fixed inset-y-0 left-0
          w-[80%] md:w-[40%]
          bg-[#FFF8F0]/95 backdrop-blur-xl
          shadow-2xl
          flex flex-col
          font-['Poppins']
          animate-in slide-in-from-left duration-300
        "
      >
        {/* --- HEADER --- */}
        <div 
          className="relative px-6 py-6 border-b border-[#68232B]/10 flex justify-between items-center"
        >
          {/* Subtle Texture Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none bg-cover bg-center"
            style={{ backgroundImage: `url(${footerBg})` }}
          />
          
          <div className="flex items-center gap-3 z-10 text-[#e2a10a]">
            <div className="p-2 bg-[#68232B]/10 rounded-full text-[#e2a10a]">
                <Filter size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-wide">
              Filters & Sort
            </h2>
          </div>

          <button
            onClick={onClose}
            className="z-10 p-2 hover:bg-[#68232B]/10 rounded-full transition-colors text-[#FFCB85]"
          >
            <X size={24} />
          </button>
        </div>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FFCB85]/70 backdrop-blur-md">
          
          {/* 1. PRICE FILTER */}
          <div className="border border-[#68232B]/10 rounded-2xl bg-white/40 overflow-hidden">
            <button
              onClick={() => toggleSection("price")}
              className="w-full flex justify-between items-center p-4 hover:bg-white/60 transition-colors"
            >
              <h3 className="font-semibold text-[#68232B]">Price Range</h3>
              {openSections.price ? <ChevronUp size={18} className="text-[#68232B]"/> : <ChevronDown size={18} className="text-[#68232B]/60"/>}
            </button>

            {openSections.price && (
              <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-4 mt-2">
                  <div className="space-y-1 w-full">
                    <label className="text-xs text-gray-500 font-medium ml-1">Min (₹)</label>
                    <Input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(Number(e.target.value))}
                      className="bg-white border-[#68232B]/20 focus:border-[#68232B] focus:ring-[#68232B]/20 h-10 rounded-xl"
                    />
                  </div>
                  <div className="h-[1px] w-4 bg-[#68232B]/30 mt-5"></div>
                  <div className="space-y-1 w-full">
                    <label className="text-xs text-gray-500 font-medium ml-1">Max (₹)</label>
                    <Input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                      className="bg-white border-[#68232B]/20 focus:border-[#68232B] focus:ring-[#68232B]/20 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. CATEGORY FILTER */}
          <div className="border border-[#68232B]/10 rounded-2xl bg-white/40 overflow-hidden">
            <button
              onClick={() => toggleSection("category")}
              className="w-full flex justify-between items-center p-4 hover:bg-white/60 transition-colors"
            >
              <h3 className="font-semibold text-[#68232B]">Categories</h3>
              {openSections.category ? <ChevronUp size={18} className="text-[#68232B]"/> : <ChevronDown size={18} className="text-[#68232B]/60"/>}
            </button>

            {openSections.category && (
              <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col gap-3 mt-2">
                  {categories.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/80 cursor-pointer transition-all border border-transparent hover:border-[#68232B]/10"
                    >
                      <Checkbox
                        checked={selectedCategories.includes(cat)}
                        onCheckedChange={() => handleCategoryChange(cat)}
                        className="data-[state=checked]:bg-[#68232B] data-[state=checked]:border-[#68232B] border-[#68232B]/30"
                      />
                      <span className="text-sm font-medium text-gray-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. SORT FILTER */}
          <div className="border border-[#68232B]/10 rounded-2xl bg-white/40 overflow-hidden">
            <button
              onClick={() => toggleSection("sort")}
              className="w-full flex justify-between items-center p-4 hover:bg-white/60 transition-colors"
            >
              <h3 className="font-semibold text-[#68232B]">Sort By</h3>
              {openSections.sort ? <ChevronUp size={18} className="text-[#68232B]"/> : <ChevronDown size={18} className="text-[#68232B]/60"/>}
            </button>

            {openSections.sort && (
              <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                <Select
                  value={sortOption}
                  onValueChange={(value) => setSortOption(value)}
                >
                  <SelectTrigger className="w-full h-11 bg-white border-[#68232B]/20 rounded-xl focus:ring-[#68232B]/20">
                    <SelectValue placeholder="Select sorting option" />
                  </SelectTrigger>

                  <SelectContent className="bg-white/95 backdrop-blur-md border-[#68232B]/10">
                    <SelectItem value="lowToHigh">Price: Low to High</SelectItem>
                    <SelectItem value="highToLow">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

        </div>

        {/* --- FOOTER BUTTONS --- */}
        <div className="p-6 border-t border-[#68232B]/10 bg-white/50 backdrop-blur-md" style={{ backgroundImage: `url(${footerBg})` }}>
          <div className="flex gap-4">
            <button
              onClick={handleClear}
              className="
                flex-1 h-12
                rounded-full
                font-semibold text-[#68232B]
                border border-[#68232B]
                bg-gradient-to-r from-[#FEDB87] to-[#BD7923]
                transition-all duration-300
              "
            >
              Clear All
            </button>

            <button
              onClick={handleApply}
              className="
                flex-1 h-12
                rounded-full
                font-semibold text-[#68232B]
                shadow-lg shadow-orange-900/20
                bg-gradient-to-r from-[#FEDB87] to-[#BD7923]
                hover:brightness-110
                active:scale-95
                transition-all duration-300
              "
            >
              Apply Filters
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FilterAndSort;