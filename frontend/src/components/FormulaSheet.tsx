import React from "react";
import { X } from "lucide-react";

interface FormulaSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const FormulaSheet: React.FC<FormulaSheetProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Reference Formulas</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Area Formulas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Area & Circumference</h3>
              <ul className="space-y-2 text-sm text-gray-700 font-mono">
                <li><span className="font-sans font-medium text-gray-800">Circle:</span> A = πr², C = 2πr</li>
                <li><span className="font-sans font-medium text-gray-800">Rectangle:</span> A = lw</li>
                <li><span className="font-sans font-medium text-gray-800">Triangle:</span> A = ½bh</li>
                <li><span className="font-sans font-medium text-gray-800">Trapezoid:</span> A = ½(b₁ + b₂)h</li>
              </ul>
            </div>

            {/* Volume Formulas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Volume</h3>
              <ul className="space-y-2 text-sm text-gray-700 font-mono">
                <li><span className="font-sans font-medium text-gray-800">Rectangular Prism:</span> V = lwh</li>
                <li><span className="font-sans font-medium text-gray-800">Cylinder:</span> V = πr²h</li>
                <li><span className="font-sans font-medium text-gray-800">Sphere:</span> V = ⁴/₃πr³</li>
                <li><span className="font-sans font-medium text-gray-800">Cone:</span> V = ⅓πr²h</li>
                <li><span className="font-sans font-medium text-gray-800">Pyramid:</span> V = ⅓lwh</li>
              </ul>
            </div>

            {/* Right Triangle Trigonometry */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Right Triangles</h3>
              <ul className="space-y-2 text-sm text-gray-700 font-mono">
                <li><span className="font-sans font-medium text-gray-800">Pythagorean Theorem:</span> a² + b² = c²</li>
                <li><span className="font-sans font-medium text-gray-800">Trigonometric Ratios:</span></li>
                <li className="pl-4">sin θ = Opposite / Hypotenuse</li>
                <li className="pl-4">cos θ = Adjacent / Hypotenuse</li>
                <li className="pl-4">tan θ = Opposite / Adjacent</li>
              </ul>
            </div>

            {/* Circle Properties */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Special Rules</h3>
              <ul className="space-y-2 text-sm text-gray-700 font-mono">
                <li><span className="font-sans font-medium text-gray-800">Sum of Angles (Triangle):</span> 180°</li>
                <li><span className="font-sans font-medium text-gray-800">Sum of Angles (Circle):</span> 360° or 2π radians</li>
                <li><span className="font-sans font-medium text-gray-800">Arc Length:</span> s = rθ (θ in rad)</li>
                <li><span className="font-sans font-medium text-gray-800">Sector Area:</span> A = ½r²θ</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 border border-blue-100 bg-blue-50 rounded-xl">
            <h4 className="font-semibold text-blue-800 text-sm mb-1">Special Right Triangles</h4>
            <p className="text-xs text-blue-700 leading-relaxed font-mono">
              • 30°-60°-90° Triangle: Side ratio is 1 : √3 : 2.<br/>
              • 45°-45°-90° Triangle: Side ratio is 1 : 1 : √2.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors">
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormulaSheet;
