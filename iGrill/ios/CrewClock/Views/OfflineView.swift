import SwiftUI

struct OfflineView: View {
    let retryAction: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            
            ZStack {
                Circle()
                    .fill(AppConfig.brandAmber500.opacity(0.15))
                    .frame(width: 100, height: 100)
                
                Image(systemName: "wifi.slash")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundColor(AppConfig.brandAmber600)
            }
            
            VStack(spacing: 8) {
                Text("No Internet Connection")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(Color(red: 28/255, green: 25/255, blue: 23/255))
                
                Text("Please check your Wi-Fi or cellular network connection and try again.")
                    .font(.system(size: 14))
                    .foregroundColor(Color(red: 68/255, green: 64/255, blue: 60/255))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            
            Button(action: retryAction) {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .bold))
                    Text("Try Again")
                        .font(.system(size: 15, weight: .bold))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(AppConfig.brandAmber600)
                )
                .padding(.horizontal, 48)
            }
            .padding(.top, 10)
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppConfig.brandBackground.ignoresSafeArea())
    }
}
