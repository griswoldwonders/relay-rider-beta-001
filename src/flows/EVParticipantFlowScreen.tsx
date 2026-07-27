import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { EVParticipantSignal, GreenRouteCredit } from '../types';
import { nanoid } from 'nanoid';

interface EVParticipantFlowScreenProps {
  onComplete: () => void;
}

export const EVParticipantFlowScreen: React.FC<EVParticipantFlowScreenProps> = ({ onComplete }) => {
  const { addEVParticipantSignal, addGreenRouteCredit } = useApp();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    startingArea: '',
    destinationArea: '',
    travelDays: [] as string[],
    timeWindow: '',
    maxDetour: '',
    relayZoneTypes: [] as string[],
    feedbackCallWilling: false,
    reviewsAccepted: [] as string[],
  });

  const relayZoneOptions = [
    'Transit-adjacent station',
    'Library / civic space',
    'Campus edge',
    'Hospital / employment area',
    'Retail center',
    'EV charging hub',
    'Walkable public area',
  ];

  const reviewOptions = [
    'Identity review',
    'License review',
    'Insurance documentation review',
    'Vehicle / EV-hybrid status review',
    'Background / MVR workflow review',
    'Pilot participant agreement',
    'Safety / incident process review',
  ];

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onComplete();
  };

  const handleSubmit = () => {
    const signal: EVParticipantSignal = {
      id: nanoid(),
      vehicleType: formData.vehicleType as any,
      vehicleMake: formData.vehicleMake,
      vehicleModel: formData.vehicleModel,
      vehicleYear: formData.vehicleYear,
      startingArea: formData.startingArea,
      destinationArea: formData.destinationArea,
      travelDays: formData.travelDays,
      timeWindow: formData.timeWindow,
      maxDetour: formData.maxDetour,
      relayZoneTypes: formData.relayZoneTypes,
      feedbackCallWilling: formData.feedbackCallWilling,
      reviewsAccepted: formData.reviewsAccepted,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };

    addEVParticipantSignal(signal);

    const credit: GreenRouteCredit = {
      id: nanoid(),
      activity: 'EV/hybrid route pattern submitted',
      amount: 5,
      status: 'pending',
      date: new Date().toLocaleDateString(),
    };

    addGreenRouteCredit(credit);

    setStep(6);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Share Your EV/Hybrid Route Pattern" subtitle={`Step ${step} of 5`} onBack={handleBack} showBack />

      <div className="container py-6 space-y-6">
        {/* Step 1: Vehicle */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="section-title">Vehicle Information</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Vehicle Type</label>
              <select
                value={formData.vehicleType}
                onChange={e => setFormData({ ...formData, vehicleType: e.target.value })}
                className="input-field"
              >
                <option value="">Select vehicle type</option>
                <option value="ev">EV</option>
                <option value="phev">Plug-in Hybrid</option>
                <option value="hybrid">Hybrid</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Make</label>
              <input
                type="text"
                placeholder="e.g., Tesla"
                value={formData.vehicleMake}
                onChange={e => setFormData({ ...formData, vehicleMake: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Model</label>
              <input
                type="text"
                placeholder="e.g., Model 3"
                value={formData.vehicleModel}
                onChange={e => setFormData({ ...formData, vehicleModel: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Year</label>
              <input
                type="text"
                placeholder="e.g., 2023"
                value={formData.vehicleYear}
                onChange={e => setFormData({ ...formData, vehicleYear: e.target.value })}
                className="input-field"
              />
            </div>

            <button onClick={handleNext} className="btn-primary">
              Next
            </button>
          </div>
        )}

        {/* Step 2: Route Pattern */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="section-title">Route Pattern</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Common Starting Area</label>
              <input
                type="text"
                placeholder="e.g., Downtown Station"
                value={formData.startingArea}
                onChange={e => setFormData({ ...formData, startingArea: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Common Destination Area</label>
              <input
                type="text"
                placeholder="e.g., Tech Park"
                value={formData.destinationArea}
                onChange={e => setFormData({ ...formData, destinationArea: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Travel Days</label>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <label key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.travelDays.includes(day)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({ ...formData, travelDays: [...formData.travelDays, day] });
                        } else {
                          setFormData({ ...formData, travelDays: formData.travelDays.filter(d => d !== day) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Time Window</label>
              <input
                type="text"
                placeholder="e.g., 7:30–8:30 AM"
                value={formData.timeWindow}
                onChange={e => setFormData({ ...formData, timeWindow: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                Back
              </button>
              <button onClick={handleNext} className="btn-primary flex-1">
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Detour Comfort */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="section-title">Detour Comfort</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Maximum Comfortable Detour</label>
              <select
                value={formData.maxDetour}
                onChange={e => setFormData({ ...formData, maxDetour: e.target.value })}
                className="input-field"
              >
                <option value="">Select detour tolerance</option>
                <option value="0-5">0–5 minutes</option>
                <option value="5-10">5–10 minutes</option>
                <option value="10-15">10–15 minutes</option>
                <option value="depends">Depends on route fit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Preferred Relay Zone Types</label>
              <div className="space-y-2">
                {relayZoneOptions.map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.relayZoneTypes.includes(option)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({ ...formData, relayZoneTypes: [...formData.relayZoneTypes, option] });
                        } else {
                          setFormData({ ...formData, relayZoneTypes: formData.relayZoneTypes.filter(z => z !== option) });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.feedbackCallWilling}
                onChange={e => setFormData({ ...formData, feedbackCallWilling: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Would you consider feedback calls?</span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                Back
              </button>
              <button onClick={handleNext} className="btn-primary flex-1">
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Future Review Willingness */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="section-title">Future Review Willingness</h2>
            <p className="text-xs text-gray-600">Which reviews are you willing to participate in?</p>

            <div className="space-y-2">
              {reviewOptions.map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.reviewsAccepted.includes(option)}
                    onChange={e => {
                      if (e.target.checked) {
                        setFormData({ ...formData, reviewsAccepted: [...formData.reviewsAccepted, option] });
                      } else {
                        setFormData({ ...formData, reviewsAccepted: formData.reviewsAccepted.filter(r => r !== option) });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>

            <div className="bg-light-blue border border-blue-300 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>Important:</strong> Do not present this as becoming a paid driver. Relay Rider should not dispatch drivers to create trips on demand.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                Back
              </button>
              <button onClick={handleNext} className="btn-primary flex-1">
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="section-title">Submit Route Participant Signal</h2>

            <div className="card space-y-3">
              <div>
                <p className="text-xs text-gray-600">Vehicle</p>
                <p className="font-semibold text-navy mt-1">{formData.vehicleYear} {formData.vehicleMake} {formData.vehicleModel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Route</p>
                <p className="font-semibold text-navy mt-1">{formData.startingArea} → {formData.destinationArea}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Max Detour</p>
                <p className="font-semibold text-navy mt-1">{formData.maxDetour}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                Back
              </button>
              <button onClick={handleSubmit} className="btn-primary flex-1">
                Submit Route Participant Signal
              </button>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {step === 6 && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 bg-light-green rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-navy mb-2">Thank you!</h2>
              <p className="text-sm text-gray-600">
                Your route pattern helps validate EV/hybrid corridor supply. This does not activate a route, create compensation, or confirm pilot eligibility.
              </p>
            </div>

            <button onClick={onComplete} className="btn-primary">
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
