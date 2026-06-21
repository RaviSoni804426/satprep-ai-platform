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
              <ul className="space-y-2 text-sm text-gray-700">
                <li><span className="font-medium">Circle:</span> \(A = \pi r^2\), \(C = 2\pi r\)</li>
                <li><span className="font-medium">Rectangle:</span> \(A = \ell w\)</li>
                <li><span className="font-medium">Triangle:</span> \(A = \frac{1}{2}bh\)</li>
                <li><span className="font-medium">Trapezoid:</span> \(A = \frac{1}{2}(b_1 + b_2)h\)</li>
              </ul>
            </div>

            {/* Volume Formulas */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Volume</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li><span className="font-medium">Rectangular Prism:</span> \(V = \ell w h\)</li>
                <li><span className="font-medium">Cylinder:</span> \(V = \pi r^2 h\)</li>
                <li><span className="font-medium">Sphere:</span> \(V = \frac{4}{3}\pi r^3\)</li>
                <li><span className="font-medium">Cone:</span> \(V = \frac{1}{3}\pi r^2 h\)</li>
                <li><span className="font-medium">Pyramid:</span> \(V = \frac{1}{3}\ell w h\)</li>
              </ul>
            </div>

            {/* Right Triangle Trigonometry */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Right Triangles</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li><span className="font-medium">Pythagorean Theorem:</span> \(a^2 + b^2 = c^2\)</li>
                <li><span className="font-medium">Trigonometric Ratios:</span></li>
                <li className="pl-4">\(\sin \theta = \frac{\text{Opposite}}{\text{Hypotenuse}}\)</li>
                <li className="pl-4">\(\cos \theta = \frac{\text{Adjacent}}{\text{Hypotenuse}}\)</li>
                <li className="pl-4">\(\tan \theta = \frac{\text{Opposite}}{\text{Adjacent}}\)</li>
              </ul>
            </div>

            {/* Circle Properties */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="font-semibold text-primary mb-3 text-sm uppercase tracking-wider">Special Rules</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li><span className="font-medium">Sum of Angles (Triangle):</span> \(180^\circ\)</li>
                <li><span className="font-medium">Sum of Angles (Circle):</span> \(360^\circ\) or \(2\pi\) radians</li>
                <li><span className="font-medium">Arc Length:</span> \(s = r\theta\) (\(\theta\) in radians)</li>
                <li><span className="font-medium">Sector Area:</span> \(A = \frac{1}{2}r^2\theta\)</li>
              </ul>
            </div>
          </div>
          
          <div className="p-4 border border-blue-100 bg-blue-50 rounded-xl">
            <h4 className="font-semibold text-blue-800 text-sm mb-1">Special Right Triangles</h4>
            <p className="text-xs text-blue-700">
              • 30°-60°-90° Triangle: Sides are in the ratio \(1 : \sqrt{3} : 2\).<br/>
              • 45°-45°-90° Triangle: Sides are in the ratio \(1 : 1 : \sqrt{2}\).
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
