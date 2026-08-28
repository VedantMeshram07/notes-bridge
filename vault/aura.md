# AURA - AI-Powered Mental Health Companion

A comprehensive mental health support application featuring multiple AI agents working together to provide personalized care, crisis intervention, and therapeutic resources.

## 🌟 New Features (Latest Update)

### 🛡️ Enhanced Aegis Safety Guardian

- **Global & Region-Specific Helplines**: Comprehensive database of mental health crisis resources for 15+ countries
- **Smart Crisis Detection**: Enhanced trigger detection with immediate helpline provision
- **Dedicated Aegis Agent**: Separate agent file with multiple endpoints for different types of help requests
- **Crisis Response Formatting**: Beautifully formatted responses with emojis and clear contact information

### 🎯 Agent Activity Tracking System

- **Visual Agent Status**: Real-time indicators showing which agents are active
- **Background Agent Monitoring**: Yellow strips show agents working in the background
- **Active Agent Highlighting**: Clear visual distinction between current and background agents
- **Smooth Animations**: Pulse and shimmer effects for active background agents

### 🌓 Dark/Light Mode

- **Theme Toggle**: Easy switching between dark and light themes
- **Persistent Preferences**: Theme choice saved in localStorage
- **Smooth Transitions**: All UI elements transition smoothly between themes
- **CSS Variables**: Comprehensive theming system with 20+ color variables

### 💬 Enhanced Chat Experience

- **Separate Chat Box**: Chat section appears as a distinct, attractive container
- **Mental Health Awareness Colors**: Purple and blue gradients throughout the app
- **Wellness Journey**: Renamed "Chat History" to "Wellness Journey" for better mental health focus
- **Improved Visual Design**: Enhanced chat bubbles with better spacing and shadows

### 🧠 Strengthened Orion Analyzer

- **Comprehensive Analysis**: 10+ mental health parameters analyzed
- **Risk Level Assessment**: Critical, high, medium, low risk categorization
- **Detailed Recommendations**: Specific suggestions for each detected issue
- **Pattern Recognition**: Social anxiety, crisis risk, sleep issues, relationship stress detection
- **Sentiment Analysis**: Basic positive/negative trend analysis

### 📊 Enhanced Metric System

- **10-Parameter Assessment**: depression, anxiety, stress, social_anxiety, self_worth, sleep_quality, energy_level, coping_skills, social_support, life_satisfaction
- **Overall Mental Health Score**: Calculated from all parameters
- **Mental Health Status**: excellent, good, moderate, concerning, critical
- **Pinpoint State Analysis**: More accurate user state identification

## 🏗️ Architecture

### AI Agents

1. **Kai** - Initial Check-in & Screening

   - Age-specific questions
   - Enhanced 10-parameter metric system
   - Progress tracking with visual indicators

2. **Elara** - Conversational Partner

   - Natural, empathetic conversations
   - Crisis detection and Aegis activation
   - Chat history persistence

3. **Vero** - Resource Strategist

   - Mental health resources and techniques
   - Daily mental health tips via WatsonX.ai
   - Personalized resource recommendations

4. **Aegis** - Safety Guardian

   - Global and region-specific helplines
   - Crisis detection and intervention
   - Emergency contact information

5. **Orion** - Silent Analyst
   - Background user analysis
   - Pattern recognition and insights
   - Risk assessment and recommendations

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js (for frontend development)
- Firebase account
- WatsonX.ai account (optional)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd aura-mental-health-app
   ```

2. **Backend Setup**

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Environment Configuration**

   ```bash
   cp env_example.txt .env
   # Edit .env with your credentials
   ```

4. **Firebase Setup**

   - Create a Firebase project
   - Download `serviceAccountKey.json` to `backend/`
   - Enable Firestore and Authentication

5. **Start the Backend**

   ```bash
   python main.py
   ```

6. **Frontend Setup**
   ```bash
   cd frontend
   # Open index.html in a web browser
   # Or serve with a local server
   ```

## 🔧 Configuration

### Environment Variables

```env
WATSONX_API_KEY=your_watsonx_api_key
WATSONX_PROJECT_ID=your_project_id
```

### Firebase Configuration

- Place `serviceAccountKey.json` in the backend directory
- Enable Firestore and Authentication services
- Set up security rules for your collections

## 🌍 Supported Regions

Aegis provides helplines for:

- **North America**: US, Canada
- **Europe**: UK, Germany, France
- **Asia-Pacific**: India, Australia, Japan
- **Latin America**: Brazil, Mexico
- **Africa**: South Africa, Nigeria
- **Middle East**: UAE
- **Global**: International resources

## 🎨 UI/UX Features

### Visual Design

- **Mental Health Awareness Colors**: Purple and blue gradients
- **Smooth Animations**: Fade-in effects, hover animations
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Professional Branding**: Polished, final-product appearance

### User Experience

- **Intuitive Navigation**: Clear screen transitions
- **Progress Indicators**: Visual feedback for all processes
- **Accessibility**: High contrast, readable fonts
- **Gamification**: Progress bars and achievement-like feedback

## 🔒 Security & Privacy

- **Firebase Authentication**: Secure user management
- **Password Hashing**: bcrypt encryption
- **CORS Protection**: Cross-origin request security
- **Data Encryption**: All sensitive data encrypted in transit

## 🧪 Testing

Run the test suite:

```bash
cd backend
python test.py
```

## 📈 Monitoring

### Agent Activity

- Real-time agent status tracking
- Background processing indicators
- Performance monitoring

### User Analytics

- Mental health trend analysis
- Usage pattern recognition
- Risk assessment tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Crisis Support

If you or someone you know is in crisis:

- **US**: Call 988 (National Suicide Prevention Lifeline)
- **Global**: Call 112 (Emergency Services)
- **Text Support**: Text HOME to 741741 (Crisis Text Line)

## 🙏 Acknowledgments

- IBM WatsonX.ai for AI capabilities
- Firebase for backend services
- Mental health professionals for guidance
- Open source community for tools and libraries

---

**AURA** - Empowering mental health through AI companionship and support.
