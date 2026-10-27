import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { TrustGridProvider } from './context/TrustGridContext';
import { AppLayout } from './components/AppLayout';
import { ChatView } from './views/ChatView';
import { OverviewLandingView } from './views/OverviewLandingView';
import { ResearchView } from './views/ResearchView';
import { ProjectsView } from './views/ProjectsView';
import { AgentsView } from './views/AgentsView';
import { KnowledgeView } from './views/KnowledgeView';
import { TasksView } from './views/TasksView';
import { AboutView } from './views/AboutView';
import { SettingsView } from './views/SettingsView';
import { AndroidAppView } from './views/AndroidAppView';
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

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <TrustGridProvider>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Vaelor Multi-Agent Intelligence Workspace */}
              <Route path="/" element={<ChatView />} />
              <Route path="/chat" element={<ChatView />} />
              <Route path="/overview" element={<OverviewLandingView />} />
              <Route path="/research" element={<ResearchView />} />
              <Route path="/projects" element={<ProjectsView />} />
              <Route path="/agents" element={<AgentsView />} />
              <Route path="/knowledge" element={<KnowledgeView />} />
              <Route path="/tasks" element={<TasksView />} />
              <Route path="/android" element={<AndroidAppView />} />
              <Route path="/settings" element={<SettingsView />} />

              {/* Aurenyx TrustGrid AI Workflow Governance Suite */}
              <Route path="/trustgrid" element={<TrustGridHomeView />} />
              <Route path="/dashboard" element={<TrustGridDashboardView />} />
              <Route path="/demo" element={<TrustGridDemoView />} />
              <Route path="/product" element={<TrustGridProductView />} />
              <Route path="/solutions" element={<TrustGridSolutionsView />} />
              <Route path="/passport" element={<TrustGridPassportView />} />
              <Route path="/assessment" element={<TrustGridAssessmentView />} />
              <Route path="/risk-rules" element={<TrustGridRiskRulesView />} />
              <Route path="/testing" element={<TrustGridTestingView />} />
              <Route path="/safeguards" element={<TrustGridSafeguardsView />} />
              <Route path="/reports" element={<TrustGridReportsView />} />
              <Route path="/implementation" element={<TrustGridImplementationView />} />
              <Route path="/about" element={<AboutView />} />
              <Route path="/contact" element={<TrustGridContactView />} />
              <Route path="/privacy" element={<TrustGridPrivacyView />} />
              <Route path="/terms" element={<TrustGridTermsView />} />
              <Route path="/faq" element={<TrustGridFaqView />} />

              {/* Custom 404 Not Found Page */}
              <Route path="*" element={<NotFoundView />} />
            </Route>
          </Routes>
        </TrustGridProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
