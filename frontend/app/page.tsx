export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Welcome to StrataGPT
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your AI-powered assistant for navigating strata law with confidence.
          Upload documents, ask questions, and get expert guidance instantly.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/signup"
            className="btn btn-primary px-6 py-3 text-lg"
          >
            Get Started
          </a>
          <a
            href="/signin"
            className="btn btn-secondary px-6 py-3 text-lg"
          >
            Sign In
          </a>
        </div>
        
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Upload Documents</h3>
            <p className="text-gray-600">
              Securely upload your strata documents, by-laws, and meeting minutes for AI analysis.
            </p>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Ask Questions</h3>
            <p className="text-gray-600">
              Get instant answers to your strata law questions based on your specific documents.
            </p>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-3">Expert Guidance</h3>
            <p className="text-gray-600">
              Receive clear, actionable advice tailored to your strata scheme&apos;s unique situation.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}