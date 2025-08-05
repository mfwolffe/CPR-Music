'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Nav, Tab } from 'react-bootstrap';
import { useEffects } from '../../../../contexts/DAWProvider';
import EQ from './EQ';
import Echo from './Echo';
import Reverb from './Reverb';
import Chorus from './Chorus';

/**
 * Effects Rack - Tabbed container for all effects
 * Shows all effects in tabs below the DAW
 */
export default function EffectsRack({ width }) {
  const { 
    setEqPresent,
    setRvbPresent,
    setReverbPresent,
    setChrPresent
  } = useEffects();
  
  // Track active tab
  const [activeTab, setActiveTab] = useState('eq');
  
  // Enable all effects when rack is opened
  useEffect(() => {
    setEqPresent(true);
    setRvbPresent(true);
    setReverbPresent(true);
    setChrPresent(true);
    
    // Cleanup: disable all when unmounted
    return () => {
      setEqPresent(false);
      setRvbPresent(false);
      setReverbPresent(false);
      setChrPresent(false);
    };
  }, [setEqPresent, setRvbPresent, setReverbPresent, setChrPresent]);
  
  // All tabs are always available in the rack
  const tabs = [
    { key: 'eq', title: 'Equalizer', component: EQ },
    { key: 'echo', title: 'Echo', component: Echo },
    { key: 'reverb', title: 'Reverb', component: Reverb },
    { key: 'chorus', title: 'Chorus', component: Chorus }
  ];
  
  return (
    <Card id="effects-rack" style={{ width: `${width}%`, maxHeight: '200px' }}>
      <CardBody className="bg-dawcontrol text-white p-0">
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          {/* Tab Navigation */}
          <Nav variant="tabs" className="bg-daw-toolbars" style={{ minHeight: '30px' }}>
            {tabs.map(tab => (
              <Nav.Item key={tab.key} style={{ flex: 1 }}>
                <Nav.Link 
                  eventKey={tab.key}
                  className={activeTab === tab.key ? 'active-effect-tab' : 'inactive-effect-tab'}
                  style={{ 
                    padding: '0.25rem 0.5rem', 
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}
                >
                  {tab.title}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
          
          {/* Tab Content */}
          <Tab.Content className="pt-1" style={{ height: '160px', overflowY: 'auto' }}>
            {tabs.map(tab => {
              const Component = tab.component;
              return (
                <Tab.Pane key={tab.key} eventKey={tab.key}>
                  <Component width={100} />
                </Tab.Pane>
              );
            })}
          </Tab.Content>
        </Tab.Container>
      </CardBody>
    </Card>
  );
}