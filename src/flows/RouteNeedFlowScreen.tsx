import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { RouteSignal, GreenRouteCredit } from '../types';
import { nanoid } from 'nanoid';

interface RouteNeedFlowScreenProps {
  onComplete: () => void;
}

export const RouteNeedFlowScreen: React.FC<RouteNeedFlowScreenProps> = ({ onComplete }) => {
  const { addRouteSignal, addGreenRouteCredit } = useApp();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    corridor: '',
    startingArea: '',
    destinationArea: '',
    daysOfWeek: [] as string[],
    timeWindow: '',
    routeType: '',
    relayZoneType: [] as string[],
    routeBidSignal: '',
    evPreference: '',
    maxWalkingDistance: '',
    privacyPreference: '',
    adultConfirmed: false,
    researchConsent: false,
  });

  const corridorOptions = [
    'Pasadena ↔ Eagle Rock ↔ Glendale',
    'Hollywood / East Hollywood → Glendale / Pasadena',
    'Burbank Airport → Glendale → Pasadena',
    'LAX → Pasadena / SGV',
    'Other',
  ];

  const relayZoneOptions = [
    'Transit-adjacent station',
    'Library / civic space',
    'Campus edge',
    'Hospital / employment area',
    'Retail center',
    'EV charging hub',
    'Walkable public area',
    'Not sure yet',
  ];

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onComplete();
  };

  const handleSubmit = () => {
    // Create route signal
    const signal: RouteSignal = {
      id: nanoid(),
      corridor: formData.corridor,
      startingArea: formData.startingArea,
      destinationArea: formData.destinationArea,
      daysOfWeek: formData.daysOfWeek,
      timeWindow: formData.timeWindow,
      routeType: formData.routeType as any,
      relayZoneType: formData.relayZoneType,
      routeBidSignal: formData.routeBidSignal,
      evPreference: formData.evPreference as any,
      maxWalkingDistance: formData.maxWalkingDistance,
      privacyPreference: formData.privacyPreference,
      status: 'submitted',
      routeFit: 'moderate',
      greenRouteCredit: 3,
      createdAt: new Date().toISOString(),
      modeled: {
        overlapPotential: 'medium',
        timeCompatibility: 'moderate',
        relayZoneFit: 'moderate',
        evHybridSupply: 'needs-more',
        parkingPressure: 'medium',
        pilotReadiness: 'research-only',
      },
    };

    addRouteSignal(signal);

    // Add green route credit
    const credit: GreenRouteCredit = {
      id: nanoid(),
      activity: 'Route interest profile submitted',
      amount: 3,
      status: 'pending',
      date: new Date().toLocaleDateString(),
    };

    addGreenRouteCredit(credit);

    // Go to success screen
    setStep(7);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Share Your Route Need" subtitle={`Step ${step} of 6`} onBack={handleBack} showBack />

      <div className="container py-6 space-y-6">
        {/* Step 1: Where are you going? */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="section-title">Where are you going?</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Common Corridor</label>
              <select
                value={formData.corridor}
                onChange={e => setFormData({ ...formData, corridor: e.target.value })}
                className="input-field"
              >
                <option value="">Select a corridor</option>
                {corridorOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Starting Area</label>
              <input
                type="text"
                placeholder="e.g., Downtown Station"
                value={formData.startingArea}
                onChange={e => setFormData({ ...formData, startingArea: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Destination Area</label>
              <input
                type="text"
                placeholder="e.g., Tech Park, Building A"
                value={formData.destinationArea}
                onChange={e => setFormData({ ...formData, destinationArea: e.target.value })}
                className="input-field"
              />
            </div>

            <button onClick={handleNext} className="btn-primary">
              Next
            </button>
          </div>
        )}

        {/* Step 2: When do you usually travel? */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="section-title">When do you usually travel?</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Days of Week</label>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <label key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.daysOfWeek.includes(day)}
                      onChange={e => {
                        if (e.target.checked) {
                          setFormData({ ...formData, daysOfWeek: [...formData.daysOfWeek, day] });
                        } else {
                          setFormData({ ...formData, daysOfWeek: formData.daysOfWeek.filter(d => d !== day) });
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

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Travel Pattern</label>
              <select
                value={formData.routeType}
                onChange={e => setFormData({ ...formData, routeType: e.target.value })}
                className="input-field"
              >
                <option value="">Select pattern</option>
                <option value="recurring">Recurring commute</option>
                <option value="occasional">Occasional route</option>
                <option value="event">Event / venue access</option>
                <option value="medical">Medical / hospital access</option>
                <option value="campus">Campus / school-adjacent adult commute</option>
                <option value="other">Other</option>
              </select>
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

        {/* Step 3: Relay Zone Types */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="section-title">Choose preferred Relay Zone types</h2>

            <div className="space-y-2">
              {relayZoneOptions.map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.relayZoneType.includes(option)}
                    onChange={e => {
                      if (e.target.checked) {
                        setFormData({ ...formData, relayZoneType: [...formData.relayZoneType, option] });
                      } else {
                        setFormData({ ...formData, relayZoneType: formData.relayZoneType.filter(z => z !== option) });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 mt-4">
              <input type="checkbox" defaultChecked className="w-4 h-4" />
              <span className="text-sm text-gray-700">I prefer public Relay Zones over exact private-address pickup/dropoff.</span>
            </label>

            <div className="bg-light-blue border border-blue-300 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>Note:</strong> Relay Zones are planning concepts. Locations must be reviewed before any future pilot use.
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

        {/* Step 4: Route-bid Signal */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="section-title">What route contribution would feel reasonable for this corridor?</h2>
            <p className="text-xs text-gray-600 font-semibold">Research-only route-bid signal</p>

            <div className="space-y-2">
              {['$5', '$10', '$15', '$20', '$25+', 'Not sure'].map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bid"
                    value={option}
                    checked={formData.routeBidSignal === option}
                    onChange={e => setFormData({ ...formData, routeBidSignal: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>

            <div className="bg-warning-yellow border border-yellow-400 rounded-lg p-3">
              <p className="text-xs text-yellow-900">
                <strong>Note:</strong> This does not create a payment, fare, booking, or route commitment. It helps Relay Rider understand willingness-to-participate for future pilot planning.
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

        {/* Step 5: Preferences */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="section-title">Preferences</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">EV/Hybrid Preference</label>
              <select
                value={formData.evPreference}
                onChange={e => setFormData({ ...formData, evPreference: e.target.value })}
                className="input-field"
              >
                <option value="">Select preference</option>
                <option value="ev-only">EV only</option>
                <option value="hybrid-ev">Hybrid or EV</option>
                <option value="any">Any vehicle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Maximum Walking Distance to Relay Zone</label>
              <select
                value={formData.maxWalkingDistance}
                onChange={e => setFormData({ ...formData, maxWalkingDistance: e.target.value })}
                className="input-field"
              >
                <option value="">Select distance</option>
                <option value="under-5">Under 5 minutes</option>
                <option value="5-10">5–10 minutes</option>
                <option value="10-15">10–15 minutes</option>
                <option value="depends">Depends on location</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Privacy Preference</label>
              <select
                value={formData.privacyPreference}
                onChange={e => setFormData({ ...formData, privacyPreference: e.target.value })}
                className="input-field"
              >
                <option value="">Select preference</option>
                <option value="public-zones">Use public Relay Zones only</option>
                <option value="mask-address">Mask private address until future review</option>
                <option value="not-sure">Not sure</option>
              </select>
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

        {/* Step 6: Review and Submit */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="section-title">Review Your Signal</h2>

            <div className="card space-y-3">
              <div>
                <p className="text-xs text-gray-600">Corridor</p>
                <p className="font-semibold text-navy mt-1">{formData.corridor}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Route</p>
                <p className="font-semibold text-navy mt-1">{formData.startingArea} → {formData.destinationArea}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Time Window</p>
                <p className="font-semibold text-navy mt-1">{formData.daysOfWeek.join(', ')}, {formData.timeWindow}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Route-Bid Signal</p>
                <p className="font-semibold text-navy mt-1">{formData.routeBidSignal}</p>
              </div>
            </div>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={formData.researchConsent}
                onChange={e => setFormData({ ...formData, researchConsent: e.target.checked })}
                className="w-4 h-4 mt-1"
              />
              <span className="text-xs text-gray-700">
                I understand this is a research-beta signal and agree to the terms of participation.
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={formData.adultConfirmed}
                onChange={e => setFormData({ ...formData, adultConfirmed: e.target.checked })}
                className="w-4 h-4 mt-1"
              />
              <span className="text-xs text-gray-700">
                I confirm I am 18 or older.
              </span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.researchConsent || !formData.adultConfirmed}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Submit Route Interest Signal
              </button>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {step === 7 && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 bg-light-green rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-navy mb-2">Your route signal was submitted.</h2>
              <p className="text-sm text-gray-600">
                Your response helps validate commuter demand for research-beta planning. This is not a transportation booking, guaranteed route, fare, or active route commitment.
              </p>
            </div>

            <div className="space-y-2">
              <button onClick={onComplete} className="btn-primary">
                View My Signal
              </button>
              <button onClick={onComplete} className="btn-secondary">
                Explore Relay Zones
              </button>
              <button onClick={onComplete} className="btn-outline">
                Invite Another Co-Commuter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
