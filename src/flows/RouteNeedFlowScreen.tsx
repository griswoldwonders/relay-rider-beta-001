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
    campusAffiliation: '',
    daysOfWeek: [] as string[],
    timeWindow: '',
    routeType: '',
    relayZoneType: [] as string[],
    transitOptions: [] as string[],
    studentTransitPass: 'not-sure',
    incentiveInterests: [] as string[],
    evPreference: '',
    maxWalkingDistance: '',
    privacyPreference: '',
    adultConfirmed: false,
    researchConsent: false,
  });

  const corridorOptions = [
    'Pasadena ↔ Eagle Rock ↔ Glendale',
    'Hollywood / East Hollywood → Glendale / Pasadena',
    'Burbank → Glendale → Pasadena',
    'Other',
  ];

  const campusOptions = [
    'Pasadena City College',
    'Glendale Community College',
    'Caltech',
    'ArtCenter College of Design',
    'Cal State LA',
    'Other college / university',
    'Not affiliated with a college',
  ];

  const accessPointOptions = [
    'Metro / transit station',
    'Library / civic space',
    'Campus edge',
    'Hospital / employment area',
    'Retail center',
    'EV charging hub',
    'Walkable public area',
    'Not sure yet',
  ];

  const transitOptions = [
    'LA Metro rail',
    'LA Metro bus',
    'Pasadena Transit',
    'Glendale Beeline',
    'Metro Micro / local on-demand transit',
    'Bike / walk connection',
  ];

  const incentiveOptions = [
    'Green Route Credits',
    'Campus commute challenges',
    'Transit participation rewards',
    'EV / clean-route recognition',
    'Access Point participation rewards',
  ];

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onComplete();
  };

  const toggleArrayValue = (field: 'daysOfWeek' | 'relayZoneType' | 'transitOptions' | 'incentiveInterests', value: string) => {
    const values = formData[field];
    setFormData({
      ...formData,
      [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value],
    });
  };

  const handleSubmit = () => {
    const signal: RouteSignal = {
      id: nanoid(),
      corridor: formData.corridor,
      startingArea: formData.startingArea,
      destinationArea: formData.destinationArea,
      campusAffiliation: formData.campusAffiliation,
      daysOfWeek: formData.daysOfWeek,
      timeWindow: formData.timeWindow,
      routeType: formData.routeType as RouteSignal['routeType'],
      relayZoneType: formData.relayZoneType,
      transitOptions: formData.transitOptions,
      studentTransitPass: formData.studentTransitPass as RouteSignal['studentTransitPass'],
      incentiveInterests: formData.incentiveInterests,
      evPreference: formData.evPreference as RouteSignal['evPreference'],
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

    const credit: GreenRouteCredit = {
      id: nanoid(),
      activity: 'Commute profile submitted',
      amount: 3,
      status: 'pending',
      date: new Date().toLocaleDateString(),
    };

    addGreenRouteCredit(credit);
    setStep(7);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Share Your Commute Need" subtitle={`Step ${Math.min(step, 6)} of 6`} onBack={handleBack} showBack />

      <div className="container py-6 space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="section-title">Where are you going?</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Common Corridor</label>
              <select value={formData.corridor} onChange={e => setFormData({ ...formData, corridor: e.target.value })} className="input-field">
                <option value="">Select a corridor</option>
                {corridorOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">College / Institution</label>
              <select value={formData.campusAffiliation} onChange={e => setFormData({ ...formData, campusAffiliation: e.target.value })} className="input-field">
                <option value="">Select affiliation</option>
                {campusOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-500">Selecting a school does not imply a formal partnership.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Starting Area</label>
              <input type="text" placeholder="e.g., Eagle Rock" value={formData.startingArea} onChange={e => setFormData({ ...formData, startingArea: e.target.value })} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Destination Area</label>
              <input type="text" placeholder="e.g., PCC campus area" value={formData.destinationArea} onChange={e => setFormData({ ...formData, destinationArea: e.target.value })} className="input-field" />
            </div>

            <button onClick={handleNext} className="btn-primary">Next</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="section-title">When do you usually travel?</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Days of Week</label>
              <div className="space-y-2">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <label key={day} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.daysOfWeek.includes(day)} onChange={() => toggleArrayValue('daysOfWeek', day)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Time Window</label>
              <input type="text" placeholder="e.g., 7:30–8:30 AM" value={formData.timeWindow} onChange={e => setFormData({ ...formData, timeWindow: e.target.value })} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Travel Pattern</label>
              <select value={formData.routeType} onChange={e => setFormData({ ...formData, routeType: e.target.value })} className="input-field">
                <option value="">Select pattern</option>
                <option value="recurring">Recurring commute</option>
                <option value="occasional">Occasional route</option>
                <option value="event">Event / venue access</option>
                <option value="medical">Medical / hospital access</option>
                <option value="campus">Campus commute</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleNext} className="btn-primary flex-1">Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="section-title">Choose preferred Access Point types</h2>
            <div className="space-y-2">
              {accessPointOptions.map(option => (
                <label key={option} className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.relayZoneType.includes(option)} onChange={() => toggleArrayValue('relayZoneType', option)} className="w-4 h-4" />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>

            <div className="bg-light-blue border border-blue-300 rounded-lg p-3">
              <p className="text-xs text-blue-900"><strong>Access Points:</strong> public-location candidates must be reviewed for site rules, visibility, lighting, accessibility, and general suitability before any controlled pilot use.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleNext} className="btn-primary flex-1">Next</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="section-title">Transit and commuter benefits</h2>
              <p className="text-sm text-gray-600">Tell us which alternatives you want Relay Rider to compare with compatible planned routes.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Show these local options</label>
              <div className="space-y-2">
                {transitOptions.map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.transitOptions.includes(option)} onChange={() => toggleArrayValue('transitOptions', option)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Do you already have a student transit pass or GoPass?</label>
              <select value={formData.studentTransitPass} onChange={e => setFormData({ ...formData, studentTransitPass: e.target.value })} className="input-field">
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not-sure">Not sure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Incentives I would use</label>
              <div className="space-y-2">
                {incentiveOptions.map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.incentiveInterests.includes(option)} onChange={() => toggleArrayValue('incentiveInterests', option)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-light-green p-3">
              <p className="text-xs leading-relaxed text-gray-700">
                <strong>College program:</strong> Relay Rider planned-route participation is modeled at $0 for eligible college participants. Green Route Credits are promotional participation benefits, not cash, fares, wages, or guaranteed rewards. LA Metro and other agencies may also offer fareless student programs through participating schools; eligibility must be confirmed with the school or agency.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleNext} className="btn-primary flex-1">Next</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="section-title">Preferences</h2>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">EV/Hybrid Preference</label>
              <select value={formData.evPreference} onChange={e => setFormData({ ...formData, evPreference: e.target.value })} className="input-field">
                <option value="">Select preference</option>
                <option value="ev-only">EV only</option>
                <option value="hybrid-ev">Hybrid or EV</option>
                <option value="any">Any eligible vehicle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Maximum Walking Distance to an Access Point</label>
              <select value={formData.maxWalkingDistance} onChange={e => setFormData({ ...formData, maxWalkingDistance: e.target.value })} className="input-field">
                <option value="">Select distance</option>
                <option value="under-5">Under 5 minutes</option>
                <option value="5-10">5–10 minutes</option>
                <option value="10-15">10–15 minutes</option>
                <option value="depends">Depends on location</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy mb-2">Privacy Preference</label>
              <select value={formData.privacyPreference} onChange={e => setFormData({ ...formData, privacyPreference: e.target.value })} className="input-field">
                <option value="">Select preference</option>
                <option value="public-zones">Use public Access Points only</option>
                <option value="mask-address">Keep private address masked</option>
                <option value="not-sure">Not sure</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleNext} className="btn-primary flex-1">Next</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="section-title">Review Your Commute Signal</h2>

            <div className="card space-y-3">
              <div><p className="text-xs text-gray-600">College / Institution</p><p className="font-semibold text-navy mt-1">{formData.campusAffiliation || 'Not specified'}</p></div>
              <div><p className="text-xs text-gray-600">Corridor</p><p className="font-semibold text-navy mt-1">{formData.corridor}</p></div>
              <div><p className="text-xs text-gray-600">Route</p><p className="font-semibold text-navy mt-1">{formData.startingArea} → {formData.destinationArea}</p></div>
              <div><p className="text-xs text-gray-600">Time Window</p><p className="font-semibold text-navy mt-1">{formData.daysOfWeek.join(', ')}, {formData.timeWindow}</p></div>
              <div><p className="text-xs text-gray-600">Transit options requested</p><p className="font-semibold text-navy mt-1">{formData.transitOptions.join(', ') || 'None selected'}</p></div>
              <div><p className="text-xs text-gray-600">Relay Rider college-program cost</p><p className="font-semibold text-mobility-green mt-1">$0 for eligible participants</p></div>
            </div>

            <label className="flex items-start gap-2">
              <input type="checkbox" checked={formData.researchConsent} onChange={e => setFormData({ ...formData, researchConsent: e.target.checked })} className="w-4 h-4 mt-1" />
              <span className="text-xs text-gray-700">I understand this is a research-beta signal and agree to the terms of participation.</span>
            </label>

            <label className="flex items-start gap-2">
              <input type="checkbox" checked={formData.adultConfirmed} onChange={e => setFormData({ ...formData, adultConfirmed: e.target.checked })} className="w-4 h-4 mt-1" />
              <span className="text-xs text-gray-700">I confirm I am 18 or older.</span>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setStep(step - 1)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleSubmit} disabled={!formData.researchConsent || !formData.adultConfirmed} className="btn-primary flex-1 disabled:opacity-50">Submit Commute Signal</button>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-6 text-center py-8">
            <div className="w-16 h-16 bg-light-green rounded-full flex items-center justify-center mx-auto"><span className="text-3xl">✓</span></div>
            <div>
              <h2 className="text-2xl font-bold text-navy mb-2">Your commute signal was submitted.</h2>
              <p className="text-sm text-gray-600">Your response helps Relay Rider compare planned-route compatibility, local transit options, and incentive interest. This is not a transportation booking or guaranteed route.</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-light-green p-4 text-left">
              <p className="text-sm font-bold text-navy">+3 Green Route Credits pending</p>
              <p className="mt-1 text-xs text-gray-600">Promotional research-beta credits are manually reviewed and have no guaranteed cash value.</p>
            </div>
            <div className="space-y-2">
              <button onClick={onComplete} className="btn-primary">Explore Commute Options</button>
              <button onClick={onComplete} className="btn-secondary">View My Signal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
