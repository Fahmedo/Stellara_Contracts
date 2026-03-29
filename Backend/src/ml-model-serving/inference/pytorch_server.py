#!/usr/bin/env python3
import sys
import json
import torch
import torch.nn as nn
import numpy as np
from typing import Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PyTorchModelServer:
    def __init__(self, model_path: str, model_name: str, model_version: str):
        self.model_path = model_path
        self.model_name = model_name
        self.model_version = model_version
        self.model = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        try:
            self.load_model()
            logger.info(f"PyTorch model {model_name} v{model_version} loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            sys.exit(1)
    
    def load_model(self):
        """Load PyTorch model from file"""
        try:
            self.model = torch.load(self.model_path, map_location=self.device)
            self.model.eval()
            self.model.to(self.device)
        except Exception as e:
            raise Exception(f"Error loading PyTorch model: {e}")
    
    def preprocess_input(self, input_data: Any) -> torch.Tensor:
        """Preprocess input data for model inference"""
        if isinstance(input_data, list):
            input_data = np.array(input_data)
        
        if not isinstance(input_data, np.ndarray):
            input_data = np.array(input_data)
        
        # Convert to tensor and move to device
        tensor = torch.FloatTensor(input_data)
        
        # Add batch dimension if needed
        if len(tensor.shape) == 1:
            tensor = tensor.unsqueeze(0)
        
        return tensor.to(self.device)
    
    def postprocess_output(self, output: torch.Tensor) -> Any:
        """Postprocess model output"""
        # Move to CPU and convert to numpy
        output = output.cpu().numpy()
        
        # Remove batch dimension if single prediction
        if len(output.shape) == 2 and output.shape[0] == 1:
            output = output[0]
        
        # Convert to list for JSON serialization
        return output.tolist()
    
    def predict(self, input_data: Any) -> Any:
        """Run model inference"""
        try:
            # Preprocess input
            input_tensor = self.preprocess_input(input_data)
            
            # Run inference
            with torch.no_grad():
                output = self.model(input_tensor)
            
            # Postprocess output
            result = self.postprocess_output(output)
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            return {"error": str(e)}
    
    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming prediction request"""
        try:
            if request.get("action") == "predict":
                input_data = request.get("input")
                if input_data is None:
                    return {"error": "No input data provided"}
                
                prediction = self.predict(input_data)
                return {"prediction": prediction}
            else:
                return {"error": "Unknown action"}
                
        except Exception as e:
            logger.error(f"Request handling failed: {e}")
            return {"error": str(e)}

def main():
    if len(sys.argv) != 4:
        logger.error("Usage: python pytorch_server.py <model_path> <model_name> <model_version>")
        sys.exit(1)
    
    model_path = sys.argv[1]
    model_name = sys.argv[2]
    model_version = sys.argv[3]
    
    # Initialize model server
    server = PyTorchModelServer(model_path, model_name, model_version)
    
    # Process requests from stdin
    try:
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = server.handle_request(request)
                print(json.dumps(response))
                sys.stdout.flush()
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON input: {line}")
                print(json.dumps({"error": "Invalid JSON input"}))
                sys.stdout.flush()
            except Exception as e:
                logger.error(f"Error processing request: {e}")
                print(json.dumps({"error": str(e)}))
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        logger.info("Shutting down PyTorch model server")
        sys.exit(0)

if __name__ == "__main__":
    main()
