import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { TrustGridProvider } from './context/TrustGridContext';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ChatView } from './views/ChatView';
import { OverviewLandingView } from './views/OverviewLandingView';
import { AuthView } from './views/AuthView';
import { ResearchView } from './views/ResearchView';
import { ProjectsView } from './views/ProjectsView';
import { AgentsView } from './views/AgentsView';
import { KnowledgeView } from './views/KnowledgeView';
import { TasksView } from './views/TasksView';
import { AboutView } from './views/AboutView';
import { SettingsView } from './views/SettingsView';
import { AndroidAppView } from './views/AndroidAppView';
import { MissionControlView } from './views/MissionControlView';
import { CouncilView } from './views/CouncilView';
import { CodingLabView } from './views/CodingLabView';
import {
  TrustGridHomeView,
  TrustGridProductView,
  TrustGridRiskRulesView,
  TrustGridSolutionsView,
} from './views/trustgrid/TrustGridMarketingViews';
import {
  TrustGridAssessmentView,
  TrustGridDemoView,
} from './views/trustgrid/TrustGridAssessmentView';
import {
  TrustGridDashboardView,
  TrustGridPassportView,
  TrustGridReportsView,
  TrustGridSafeguardsView,
  TrustGridTestingView,
} from './views/trustgrid/TrustGridWorkspaceViews';
import {
  NotFoundView,
  TrustGridContactView,
  TrustGridFaqView,
  TrustGridImplementationView,
  TrustGridPrivacyView,
  TrustGridTermsView,
} from './views/trustgrid/TrustGridGovernancePages';

/**
 * Public landing page loads without login when signed out;
 * authenticated users land directly in their private Chat workspace.
 */
function HomeEntryRoute() {
  const { user } = useAuth();
  return user ? <ChatView /> : <OverviewLandingView />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <TrustGridProvider>
            <Routes>
              <Route element={<AppLayout />}>
                {/* Public Entry & Authentication Routes (No login required for landing/overview/about) */}
                <Route path="/" element={<HomeEntryRoute />} />
                <Route path="/overview" element={<OverviewLandingView />} />
                <Route path="/auth" element={<AuthView />} />
                <Route path="/about" element={<AboutView />} />
                <Route path="/android" element={<AndroidAppView />} />

                {/* Protected Private Vaelor Workspace Routes */}
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute featureLabel="Chat & Multi-Agent Workspace">
                      <ChatView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/missions"
                  element={
                    <ProtectedRoute featureLabel="Mission Control DAG Workspace">
                      <MissionControlView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/council"
                  element={
                    <ProtectedRoute featureLabel="Aether Vanguard Council">
                      <CouncilView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/coding-lab"
                  element={
                    <ProtectedRoute featureLabel="Secure Coding Lab">
                      <CodingLabView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/research"
                  element={
                    <ProtectedRoute featureLabel="Deep Research Studio">
                      <ResearchView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute featureLabel="Project Workspaces">
                      <ProjectsView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agents"
                  element={
                    <ProtectedRoute featureLabel="Specialist Agents & Tools">
                      <AgentsView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/knowledge"
                  element={
                    <ProtectedRoute featureLabel="Knowledge & Saved Memory">
                      <KnowledgeView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute featureLabel="Task Workflows & Evaluation">
                      <TasksView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute featureLabel="Account, Privacy & Settings">
                      <SettingsView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute featureLabel="Account & Privacy Settings">
                      <SettingsView />
                    </ProtectedRoute>
                  }
                />

                {/* Public TrustGrid Marketing, Demo, Governance & Legal Pages */}
                <Route path="/trustgrid" element={<TrustGridHomeView />} />
                <Route path="/demo" element={<TrustGridDemoView />} />
                <Route path="/product" element={<TrustGridProductView />} />
                <Route path="/solutions" element={<TrustGridSolutionsView />} />
                <Route path="/risk-rules" element={<TrustGridRiskRulesView />} />
                <Route path="/implementation" element={<TrustGridImplementationView />} />
                <Route path="/contact" element={<TrustGridContactView />} />
                <Route path="/privacy" element={<TrustGridPrivacyView />} />
                <Route path="/terms" element={<TrustGridTermsView />} />
                <Route path="/faq" element={<TrustGridFaqView />} />

                {/* Protected Private TrustGrid Workspace Views */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute featureLabel="TrustGrid Governance Dashboard">
                      <TrustGridDashboardView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/passport"
                  element={
                    <ProtectedRoute featureLabel="AI Workflow Passports">
                      <TrustGridPassportView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assessment"
                  element={
                    <ProtectedRoute featureLabel="Risk Assessment Engine">
                      <TrustGridAssessmentView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/testing"
                  element={
                    <ProtectedRoute featureLabel="TrustGrid Scenario Testing">
                      <TrustGridTestingView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/safeguards"
                  element={
                    <ProtectedRoute featureLabel="Safeguards Catalog">
                      <TrustGridSafeguardsView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute featureLabel="TrustGrid Reports & Exports">
                      <TrustGridReportsView />
                    </ProtectedRoute>
                  }
                />

                {/* Custom 404 Not Found Page */}
                <Route path="*" element={<NotFoundView />} />
              </Route>
            </Routes>
          </TrustGridProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
